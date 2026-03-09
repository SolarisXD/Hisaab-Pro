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

/**
 * Generate next invoice number: PREFIX-YYYYMMDD-SEQ
 */
function generateInvoiceNumber(isDecoy) {
    var today = new Date();
    var dateStr = today.getFullYear().toString() +
        ('0' + (today.getMonth() + 1)).slice(-2) +
        ('0' + today.getDate()).slice(-2);

    var prefix = config.invoice_prefix;
    var pattern = prefix + '-' + dateStr + '-%';

    var stmt = db.prepare("SELECT COUNT(*) as count FROM sales WHERE is_decoy = ? AND invoice_no LIKE ?");
    var result = stmt.get(isDecoy ? 1 : 0, pattern);
    var seq = (result.count + 1).toString();
    while (seq.length < 3) { seq = '0' + seq; }

    return prefix + '-' + dateStr + '-' + seq;
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

    return db.prepare(sql).all.apply(db.prepare(sql), params);
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

    return sale;
}

/**
 * Create a new sale with line items
 */
function createSale(data, isDecoy) {
    var invoiceNo = data.invoice_no || generateInvoiceNumber(isDecoy);
    var taxPercent = data.tax_percent !== undefined ? data.tax_percent : config.tax_rate;

    // Simplified: Use total provided by user directly
    var total = data.total || 0;
    var subtotal = total; // In simplified mode, we treat total as subtotal for simplicity or just store total
    var discount = data.discount || 0;
    var taxAmount = data.tax_amount || 0;

    var insertSale = db.prepare(
        'INSERT INTO sales (invoice_no, date, customer_account_id, subtotal, tax_percent, tax_amount, discount, total, amount_paid, status, notes, ref_no, is_decoy)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );


    var transaction = db.transaction(function() {
        var result = insertSale.run(
            invoiceNo,
            data.date || new Date().toISOString().split('T')[0],
            data.customer_account_id || null,
            subtotal,
            taxPercent,
            taxAmount,
            discount,
            total,
            data.amount_paid || 0,
            data.amount_paid >= total ? 'paid' : (data.amount_paid > 0 ? 'partial' : 'pending'),
            data.notes || null,
            data.ref_no || null,
            isDecoy ? 1 : 0
        );

        var saleId = result.lastInsertRowid;

        // Update customer account balance (increase debt)
        if (data.customer_account_id) {
            var outstandingAmount = total - (data.amount_paid || 0);
            if (outstandingAmount > 0) {
                db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                    .run(outstandingAmount, data.customer_account_id);
            }

            // Record transaction
            db.prepare(
                'INSERT INTO transactions (date, account_id, type, amount, description, linked_sale_id, is_decoy)' +
                ' VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(
                data.date || new Date().toISOString().split('T')[0],
                data.customer_account_id,
                'debit',
                total,
                'Sale ' + invoiceNo,
                saleId,
                isDecoy ? 1 : 0
            );
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
    var existing = getSaleById(id, isDecoy);
    if (!existing) throw new Error('Sale not found');

    var taxPercent = data.tax_percent !== undefined ? data.tax_percent : existing.tax_percent;
    var total = data.total !== undefined ? data.total : existing.total;
    var subtotal = total;
    var discount = data.discount !== undefined ? data.discount : existing.discount;
    var taxAmount = data.tax_amount !== undefined ? data.tax_amount : existing.tax_amount;
    var amountPaid = data.amount_paid !== undefined ? data.amount_paid : existing.amount_paid;

    var transaction = db.transaction(function() {
        db.prepare(
            'UPDATE sales SET date = ?, customer_account_id = ?, subtotal = ?, tax_percent = ?, tax_amount = ?, discount = ?, total = ?, amount_paid = ?, status = ?, notes = ?, ref_no = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?'
        ).run(
            data.date || existing.date,
            data.customer_account_id !== undefined ? data.customer_account_id : existing.customer_account_id,
            subtotal, taxPercent, taxAmount, discount, total, amountPaid,
            amountPaid >= total ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending'),
            data.notes !== undefined ? data.notes : existing.notes,
            data.ref_no !== undefined ? data.ref_no : existing.ref_no,
            id
        );
    });

    transaction();
    logger.info('Sales', 'Sale updated: ID ' + id + (isDecoy ? ' [DECOY]' : ''));
    return getSaleById(id, isDecoy);
}

/**
 * Soft delete a sale
 */
function deleteSale(id, isDecoy) {
    var stmt = db.prepare('UPDATE sales SET is_deleted = 1, updated_at = datetime(\'now\', \'localtime\') WHERE id = ? AND is_decoy = ?');
    stmt.run(id, isDecoy ? 1 : 0);
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
    listSales: listSales,
    getSaleById: getSaleById,
    createSale: createSale,
    updateSale: updateSale,
    deleteSale: deleteSale,
    getSalesSummary: getSalesSummary
};
