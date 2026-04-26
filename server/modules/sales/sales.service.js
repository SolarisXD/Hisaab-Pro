/**
 * Sales Service — Hisaab Pro
 * 
 * CRUD operations for sales and line items.
 * Auto-calculates subtotal, tax, total. Generates invoice numbers.
 * Updates account balances and creates transactions.
 */

'use strict';

var { db } = require('../../db/database');
var config = require('../../config');
var logger = require('../../shared/logger');
var accountsService = require('../accounts/accounts.service');
var fyValidator = require('../../shared/fy-validator');

/**
 * Generate next invoice number: INV-X (X goes to infinite within FY)
 */
function generateInvoiceNumber(isDecoy) {
    var prefix = 'INV-';
    
    // Get the maximum serial number from active (non-deleted) sales
    var latest = db.prepare("SELECT invoice_no FROM sales WHERE is_deleted = 0 AND is_decoy = ? AND invoice_no LIKE 'INV-%' ORDER BY id DESC LIMIT 1").get(isDecoy ? 1 : 0);
    
    var maxSeq = 0;
    if (latest && latest.invoice_no) {
        var parts = latest.invoice_no.split('-');
        var lastSeq = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastSeq)) maxSeq = lastSeq;
    }

    return prefix + (maxSeq + 1);
}

/**
 * Get the next available reference number (Book-Page)
 */
function getNextRefNo(isDecoy) {
    // 1. Fetch current settings with their last update time
    var bookSetting = db.prepare("SELECT value, updated_at FROM system_settings WHERE key = 'current_book_no'").get() || { value: '1', updated_at: '2000-01-01' };
    var billSetting = db.prepare("SELECT value, updated_at FROM system_settings WHERE key = 'current_bill_no'").get() || { value: '1', updated_at: '2000-01-01' };
    
    var startBook = parseInt(bookSetting.value || '1');
    var startBill = parseInt(billSetting.value || '1');
    var settingsTime = bookSetting.updated_at > billSetting.updated_at ? bookSetting.updated_at : billSetting.updated_at;

    // 2. Get the latest non-deleted sale with its creation time
    var latest = db.prepare(
        "SELECT ref_no, created_at FROM sales WHERE is_deleted = 0 AND is_decoy = ? AND ref_no LIKE '%-%' ORDER BY id DESC LIMIT 1"
    ).get(isDecoy ? 1 : 0);

    var nextBook, nextPage;

    // 3. Logic: If settings were updated AFTER the last sale, or no sales exist, use settings.
    if (!latest || settingsTime > latest.created_at) {
        nextBook = startBook;
        nextPage = startBill;
    } else {
        // Continue from last sale
        var parts = latest.ref_no.split('-');
        var lastBook = parseInt(parts[0]) || 1;
        var lastPage = parseInt(parts[1]) || 0;

        nextBook = lastBook;
        nextPage = lastPage + 1;
        if (nextPage > 100) {
            nextBook++;
            nextPage = 1;
        }

        // Safety: If authorized sequence is ahead of last sale increment, jump to it
        var lastScore = (lastBook * 1000) + lastPage;
        var startScore = (startBook * 1000) + (startBill - 1);
        if (startScore > lastScore) {
            nextBook = startBook;
            nextPage = startBill;
        }
    }

    var pageStr = nextPage.toString();
    if (pageStr.length < 2) pageStr = '0' + pageStr;

    return nextBook + '-' + pageStr;
}

/**
 * List sales with optional filters
 */
function listSales(filters, isDecoy) {
    filters = filters || {};
    var conditions = ['s.is_deleted = 0', 's.is_decoy = ?'];
    var params = [isDecoy ? 1 : 0];

    if (filters.date_from) {
        conditions.push('s.date >= ?');
        params.push(filters.date_from);
    }
    if (filters.date_to) {
        conditions.push('s.date <= ?');
        params.push(filters.date_to);
    }
    if (filters.customer_id) {
        conditions.push('s.customer_account_id = ?');
        params.push(filters.customer_id);
    }
    if (filters.status) {
        conditions.push('s.status = ?');
        params.push(filters.status);
    }
    if (filters.search) {
        conditions.push('(s.invoice_no LIKE ? OR a.name LIKE ?)');
        params.push('%' + filters.search + '%');
        params.push('%' + filters.search + '%');
    }

    var sql = 'SELECT s.*, a.name as customer_name FROM sales s' +
        ' LEFT JOIN accounts a ON s.customer_account_id = a.id' +
        ' WHERE ' + conditions.join(' AND ') +
        ' ORDER BY s.date DESC, s.id DESC';

    if (filters.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
    }
    if (filters.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
    }

    var results = db.prepare(sql).all.apply(db.prepare(sql), params);
    results.forEach(function(r) {
        try { r.images = JSON.parse(r.images || '[]'); } catch(e) { r.images = []; }
    });
    return results;
}

/**
 * Get a single sale with its line items
 */
function getSaleById(id, isDecoy) {
    var sale = db.prepare(
        'SELECT s.*, a.name as customer_name FROM sales s' +
        ' LEFT JOIN accounts a ON s.customer_account_id = a.id' +
        ' WHERE s.id = ? AND s.is_decoy = ? AND s.is_deleted = 0'
    ).get(id, isDecoy ? 1 : 0);

    if (!sale) return null;
    
    try { sale.images = JSON.parse(sale.images || '[]'); } catch(e) { sale.images = []; }

    return sale;
}

/**
 * Create a new sale with line items
 */
function createSale(data, isDecoy) {
    // 0. Hard Financial Year Validation
    if (!isDecoy) fyValidator.validateTransactionDate(data.date);

    var invoiceNo = data.invoice_no || generateInvoiceNumber(isDecoy);
    var refNo = data.ref_no || getNextRefNo(isDecoy);
    var taxPercent = data.tax_percent !== undefined ? data.tax_percent : config.tax_rate;

    // Simplified: Use total provided by user directly
    var total = data.total || 0;
    var subtotal = total; // In simplified mode, we treat total as subtotal for simplicity or just store total
    var discount = data.discount || 0;
    var taxAmount = data.tax_amount || 0;

    var imagesJson = '[]';
    if (data.images && Array.isArray(data.images)) {
        imagesJson = JSON.stringify(data.images);
    }

    var insertSale = db.prepare(
        'INSERT INTO sales (invoice_no, date, customer_account_id, subtotal, tax_percent, tax_amount, discount, total, amount_paid, status, notes, ref_no, is_decoy, images)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );


    var transaction = db.transaction(function() {
        var now = new Date();
        var offset = now.getTimezoneOffset() * 60000;
        var localISOTime = (new Date(now.getTime() - offset)).toISOString().split('T')[0];

        var result = insertSale.run(
            invoiceNo,
            data.date || localISOTime,
            data.customer_account_id || null,
            subtotal,
            taxPercent,
            taxAmount,
            discount,
            total,
            data.amount_paid || 0,
            data.amount_paid >= total ? 'paid' : (data.amount_paid > 0 ? 'partial' : 'pending'),
            data.notes || null,
            refNo,
            isDecoy ? 1 : 0,
            imagesJson
        );

        var saleId = result.lastInsertRowid;

        // Recording the transaction is MANDATORY for all account sales
        if (data.customer_account_id) {
            var outstandingAmount = total - (data.amount_paid || 0);
            
            // 1. Update account balance (increase debt)
            db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                .run(outstandingAmount, data.customer_account_id);

            // 2. Record the Sale in ledger (Debit Customer)
            db.prepare(
                'INSERT INTO transactions (date, account_id, type, amount, description, linked_sale_id, is_decoy, is_deleted)' +
                ' VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
            ).run(
                data.date || localISOTime,
                data.customer_account_id,
                'debit',
                total,
                'Sale ' + invoiceNo,
                saleId,
                isDecoy ? 1 : 0
            );

            // 3. Record the payment in ledger if paid at time of sale
            if (data.amount_paid > 0) {
                // Leg 1: Credit Customer (decrease debt)
                db.prepare(
                    'INSERT INTO transactions (date, account_id, type, amount, description, linked_sale_id, is_decoy, is_deleted)' +
                    ' VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
                ).run(
                    data.date || localISOTime,
                    data.customer_account_id,
                    'credit',
                    data.amount_paid,
                    'Payment received for ' + invoiceNo,
                    saleId,
                    isDecoy ? 1 : 0
                );

                // Leg 2: Debit Cash/Bank (increase asset)
                var assetAccount = accountsService.getDefaultCashAccount(isDecoy); // Default to cash for sales
                if (assetAccount) {
                    db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                        .run(data.amount_paid, assetAccount.id);

                    db.prepare(
                        'INSERT INTO transactions (date, account_id, type, amount, description, linked_sale_id, is_decoy, is_deleted)' +
                        ' VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
                    ).run(
                        data.date || localISOTime,
                        assetAccount.id,
                        'debit',
                        data.amount_paid,
                        'Payment received for ' + invoiceNo + ' from ' + (data.customer_name || 'Customer'),
                        saleId,
                        isDecoy ? 1 : 0
                    );
                    
                    // Add to payments history
                    db.prepare(
                        'INSERT INTO payments (date, account_id, amount, type, mode, reference, sale_id, notes, is_decoy)' +
                        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
                    ).run(
                        data.date || localISOTime,
                        data.customer_account_id,
                        data.amount_paid,
                        'in',
                        'cash',
                        invoiceNo,
                        saleId,
                        'Payment received for ' + invoiceNo,
                        isDecoy ? 1 : 0
                    );
                }
            }
        }

        return saleId;
    });

    var saleId = transaction();
    logger.info('Sales', 'Sale created: ' + invoiceNo + ' (ID: ' + saleId + ')' + (isDecoy ? ' [DECOY]' : ''));
    return getSaleById(saleId, isDecoy);
}

/**
 * Update a sale
 */
function updateSale(id, data, isDecoy) {
    // 0. Hard Financial Year Validation
    if (!isDecoy && data.date) fyValidator.validateTransactionDate(data.date);

    var existing = getSaleById(id, isDecoy);
    if (!existing) throw new Error('Sale not found');

    var taxPercent = data.tax_percent !== undefined ? data.tax_percent : existing.tax_percent;
    var total = data.total !== undefined ? data.total : existing.total;
    var subtotal = total;
    var discount = data.discount !== undefined ? data.discount : existing.discount;
    var taxAmount = data.tax_amount !== undefined ? data.tax_amount : existing.tax_amount;
    var amountPaid = data.amount_paid !== undefined ? data.amount_paid : existing.amount_paid;

    var imagesJson = '[]';
    if (data.images && Array.isArray(data.images)) {
        imagesJson = JSON.stringify(data.images);
    } else if (existing.images) {
        // existing.images is already an array from getSaleById
        imagesJson = JSON.stringify(existing.images);
    }

    var transaction = db.transaction(function() {
        try {
            // 1. Rollback old balance impact
            if (existing.customer_account_id) {
                var oldOutstanding = existing.total - (existing.amount_paid || 0);
                // Revert customer balance: substract what we added
                db.prepare('UPDATE accounts SET current_balance = current_balance - ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                    .run(oldOutstanding, existing.customer_account_id);
                
                // Revert asset account balance if paid
                if (existing.amount_paid > 0) {
                    var oldAssetAccount = accountsService.getDefaultCashAccount(isDecoy);
                    if (oldAssetAccount) {
                        db.prepare('UPDATE accounts SET current_balance = current_balance - ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                            .run(existing.amount_paid, oldAssetAccount.id);
                    }
                }
                // Mark old transactions as deleted
                db.prepare('UPDATE transactions SET is_deleted = 1 WHERE linked_sale_id = ?').run(id);
                // Mark old payments as deleted
                db.prepare('UPDATE payments SET is_deleted = 1 WHERE sale_id = ?').run(id);
            }

            // 2. Update sale
            db.prepare(
                'UPDATE sales SET date = ?, customer_account_id = ?, subtotal = ?, tax_percent = ?, tax_amount = ?, discount = ?, total = ?, amount_paid = ?, status = ?, notes = ?, ref_no = ?, images = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?'
            ).run(
                data.date || existing.date,
                data.customer_account_id !== undefined ? data.customer_account_id : existing.customer_account_id,
                subtotal, taxPercent, taxAmount, discount, total, amountPaid,
                amountPaid >= total ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending'),
                data.notes !== undefined ? data.notes : existing.notes,
                data.ref_no !== undefined ? data.ref_no : existing.ref_no,
                imagesJson,
                id
            );

            // 3. Apply new balance impact
            var newCustomerId = data.customer_account_id !== undefined ? data.customer_account_id : existing.customer_account_id;
            if (newCustomerId) {
                var newOutstanding = total - amountPaid;
                db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                    .run(newOutstanding, newCustomerId);
                
                // Create a new fresh transaction (Debit)
                db.prepare(
                    'INSERT INTO transactions (date, account_id, type, amount, description, linked_sale_id, is_decoy, is_deleted)' +
                    ' VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
                ).run(
                    data.date || existing.date,
                    newCustomerId,
                    'debit',
                    total,
                    'Sale ' + (data.invoice_no || existing.invoice_no),
                    id,
                    isDecoy ? 1 : 0
                );

                // Create payment transactions if any (Double-Entry)
                if (amountPaid > 0) {
                    // Leg 1: Party
                    db.prepare(
                        'INSERT INTO transactions (date, account_id, type, amount, description, linked_sale_id, is_decoy, is_deleted)' +
                        ' VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
                    ).run(
                        data.date || existing.date,
                        newCustomerId,
                        'credit',
                        amountPaid,
                        'Payment received for ' + (data.invoice_no || existing.invoice_no),
                        id,
                        isDecoy ? 1 : 0
                    );

                    // Leg 2: Asset
                    var assetAccount = accountsService.getDefaultCashAccount(isDecoy);
                    if (assetAccount) {
                        db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                            .run(amountPaid, assetAccount.id);

                        db.prepare(
                            'INSERT INTO transactions (date, account_id, type, amount, description, linked_sale_id, is_decoy, is_deleted)' +
                            ' VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
                        ).run(
                            data.date || existing.date,
                            assetAccount.id,
                            'debit',
                            amountPaid,
                            'Payment received for ' + (data.invoice_no || existing.invoice_no) + ' from ' + (existing.customer_name || 'Customer'),
                            id,
                            isDecoy ? 1 : 0
                        );
                        
                        // Add to payments history
                        db.prepare(
                            'INSERT INTO payments (date, account_id, amount, type, mode, reference, sale_id, notes, is_decoy)' +
                            ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
                        ).run(
                            data.date || existing.date,
                            newCustomerId,
                            amountPaid,
                            'in',
                            'cash',
                            (data.invoice_no || existing.invoice_no),
                            id,
                            'Payment received for ' + (data.invoice_no || existing.invoice_no),
                            isDecoy ? 1 : 0
                        );
                    }
                }
            }
        } catch (innerErr) {
            logger.error('Sales', 'Transaction Failed: ' + innerErr.message);
            throw innerErr; // Re-throw to trigger rollback
        }
    });

    transaction();
    logger.info('Sales', 'Sale updated: ID ' + id + (isDecoy ? ' [DECOY]' : ''));
    return getSaleById(id, isDecoy);
}

/**
 * Soft delete a sale
*/
function deleteSale(id, isDecoy) {
    var sale = getSaleById(id, isDecoy);
    if (!sale) return false;
    
    var transaction = db.transaction(function() {
        // Mark sale as deleted and RENAME invoice_no to free it up for reuse
        var deletedInvoiceNo = sale.invoice_no + '-DEL-' + Date.now();
        db.prepare('UPDATE sales SET is_deleted = 1, invoice_no = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
            .run(deletedInvoiceNo, id);

        // Rollback customer balance - reverse the TOTAL, not just outstanding
        // Because the payment has already been credited separately
        if (sale.customer_account_id) {
            db.prepare('UPDATE accounts SET current_balance = current_balance - ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                .run(sale.total, sale.customer_account_id);
        }

        // Mark associated transactions as deleted
        db.prepare('UPDATE transactions SET is_deleted = 1 WHERE linked_sale_id = ?').run(id);

        // Mark associated payments as deleted AND rollback their asset impact
        var payments = db.prepare('SELECT * FROM payments WHERE sale_id = ? AND is_decoy = ? AND is_deleted = 0').all(id, isDecoy ? 1 : 0);
        payments.forEach(function(payment) {
            // Rollback the cash/bank account
            var assetAccount = payment.mode === 'cash' ? accountsService.getDefaultCashAccount(isDecoy) : accountsService.getDefaultBankAccount(isDecoy);
            if (assetAccount) {
                var assetRevert = payment.type === 'in' ? -payment.amount : payment.amount;
                db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                    .run(assetRevert, assetAccount.id);
            }
            
            // Reset the sale's amount_paid in the sales table (for proper status)
            if (payment.type === 'in' && sale.id) {
                db.prepare('UPDATE sales SET amount_paid = amount_paid - ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                    .run(payment.amount, sale.id);
            }
            
            db.prepare('UPDATE payments SET is_deleted = 1 WHERE id = ?').run(payment.id);
        });

        return true;
    });

    transaction();
    logger.info('Sales', 'Sale deleted: ID ' + id + (isDecoy ? ' [DECOY]' : ''));
    return true;
}

/**
 * Get sales summary for a date range
 */
function getSalesSummary(dateFrom, dateTo, isDecoy) {
    var stmt = db.prepare(
        'SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total,' +
        ' COALESCE(SUM(amount_paid), 0) as paid, COALESCE(SUM(total - amount_paid), 0) as outstanding' +
        ' FROM sales WHERE date >= ? AND date <= ? AND is_deleted = 0 AND is_decoy = ?'
    );
    return stmt.get(dateFrom, dateTo, isDecoy ? 1 : 0);
}

module.exports = {
    generateInvoiceNumber: generateInvoiceNumber,
    getNextRefNo: getNextRefNo,
    listSales: listSales,
    getSaleById: getSaleById,
    createSale: createSale,
    updateSale: updateSale,
    deleteSale: deleteSale,
    getSalesSummary: getSalesSummary
};
