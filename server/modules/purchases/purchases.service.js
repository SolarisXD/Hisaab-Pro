/**
 * Purchases Service — Hisaab Pro
 * 
 * Simplified CRUD for purchases (Supplier focused).
 */

'use strict';

var { db } = require('../../db/database');
var logger = require('../../shared/logger');
var accountsService = require('../accounts/accounts.service');

/**
 * List purchases
 */
function listPurchases(filters, isDecoy) {
    filters = filters || {};
    var conditions = ['p.is_deleted = 0', 'p.is_decoy = ?'];
    var params = [isDecoy ? 1 : 0];

    if (filters.date_from) {
        conditions.push('p.date >= ?');
        params.push(filters.date_from);
    }
    if (filters.date_to) {
        conditions.push('p.date <= ?');
        params.push(filters.date_to);
    }
    if (filters.supplier_id) {
        conditions.push('p.supplier_account_id = ?');
        params.push(filters.supplier_id);
    }
    if (filters.search) {
        conditions.push('(p.invoice_no LIKE ? OR a.name LIKE ?)');
        params.push('%' + filters.search + '%');
        params.push('%' + filters.search + '%');
    }

    var sql = 'SELECT p.*, a.name as supplier_name FROM purchases p' +
        ' LEFT JOIN accounts a ON p.supplier_account_id = a.id' +
        ' WHERE ' + conditions.join(' AND ') +
        ' ORDER BY p.date DESC, p.id DESC';

    var results = db.prepare(sql).all(...params);
    results.forEach(function(r) {
        try { r.images = JSON.parse(r.images || '[]'); } catch(e) { r.images = []; }
    });
    return results;
}

/**
 * Get purchase by ID
 */
function getPurchaseById(id, isDecoy) {
    var purchase = db.prepare(
        'SELECT p.*, a.name as supplier_name FROM purchases p' +
        ' LEFT JOIN accounts a ON p.supplier_account_id = a.id' +
        ' WHERE p.id = ? AND p.is_decoy = ? AND p.is_deleted = 0'
    ).get(id, isDecoy ? 1 : 0);
    
    if (!purchase) return null;
    try { purchase.images = JSON.parse(purchase.images || '[]'); } catch(e) { purchase.images = []; }
    return purchase;
}

/**
 * Create purchase
 */
function createPurchase(data, isDecoy) {
    var total = parseFloat(data.total) || 0;
    var amountPaid = parseFloat(data.amount_paid) || 0;
    var subtotal = parseFloat(data.subtotal) || total;
    var taxPercent = parseFloat(data.tax_percent) || 0;
    var taxAmount = parseFloat(data.tax_amount) || 0;

    var imagesJson = '[]';
    if (data.images && Array.isArray(data.images)) {
        imagesJson = JSON.stringify(data.images);
    }

    var insertPurchase = db.prepare(
        'INSERT INTO purchases (invoice_no, date, supplier_account_id, subtotal, tax_percent, tax_amount, total, amount_paid, status, ref_no, notes, is_decoy, images)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    var transaction = db.transaction(function() {
        var args = [
            data.invoice_no || ('PUR-' + Date.now()),
            data.date || new Date().toISOString().split('T')[0],
            data.supplier_account_id || null,
            subtotal,
            taxPercent,
            taxAmount,
            total,
            amountPaid,
            amountPaid >= total ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending'),
            data.ref_no || null,
            data.notes || null,
            isDecoy ? 1 : 0,
            imagesJson
        ];

        console.log('--- INSERTING PURCHASE ---');
        args.forEach((val, idx) => console.log(`Param ${idx + 1}: ${val} (${typeof val})`));

        var result = insertPurchase.run(...args);

        var purchaseId = result.lastInsertRowid;

        // Update supplier balance (increase our liability/debt to them)
        // Update supplier balance
        if (data.supplier_account_id) {
            var outstandingAmount = total - amountPaid;
            // Purchase increases liability => current_balance decreases
            db.prepare('UPDATE accounts SET current_balance = current_balance - ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                .run(outstandingAmount, data.supplier_account_id);

            // --- Leg 1: Record the Purchase in ledger (Credit Supplier) ---
            db.prepare(
                'INSERT INTO transactions (date, account_id, type, amount, description, linked_purchase_id, is_decoy, is_deleted)' +
                ' VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
            ).run(
                data.date || new Date().toISOString().split('T')[0],
                data.supplier_account_id,
                'credit', 
                total,
                'Purchase ' + data.invoice_no,
                purchaseId,
                isDecoy ? 1 : 0
            );

            // --- Leg 2: Record the Payment in ledger (Double-Entry) ---
            if (amountPaid > 0) {
                // Leg 2a: Debit Supplier (reduces liability)
                db.prepare(
                    'INSERT INTO transactions (date, account_id, type, amount, description, linked_purchase_id, is_decoy, is_deleted)' +
                    ' VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
                ).run(
                    data.date || new Date().toISOString().split('T')[0],
                    data.supplier_account_id,
                    'debit',
                    amountPaid,
                    'Payment made for ' + data.invoice_no,
                    purchaseId,
                    isDecoy ? 1 : 0
                );

                // Leg 2b: Credit Cash/Bank (reduces asset)
                var assetAccount = accountsService.getDefaultCashAccount(isDecoy);
                if (assetAccount) {
                    db.prepare('UPDATE accounts SET current_balance = current_balance - ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                        .run(amountPaid, assetAccount.id);

                    var supplierAccount = accountsService.getAccountById(data.supplier_account_id, isDecoy);
                    db.prepare(
                        'INSERT INTO transactions (date, account_id, type, amount, description, linked_purchase_id, is_decoy, is_deleted)' +
                        ' VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
                    ).run(
                        data.date || new Date().toISOString().split('T')[0],
                        assetAccount.id,
                        'credit',
                        amountPaid,
                        'Payment made for ' + data.invoice_no + ' to ' + (supplierAccount ? supplierAccount.name : 'Supplier'),
                        purchaseId,
                        isDecoy ? 1 : 0
                    );
                    
                    // Add to payments history
                    db.prepare(
                        'INSERT INTO payments (date, account_id, amount, type, mode, reference, purchase_id, notes, is_decoy)' +
                        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
                    ).run(
                        data.date || new Date().toISOString().split('T')[0],
                        data.supplier_account_id,
                        amountPaid,
                        'out',
                        'cash',
                        data.invoice_no,
                        purchaseId,
                        'Payment for purchase ' + data.invoice_no,
                        isDecoy ? 1 : 0
                    );
                }
            }
        }

        return purchaseId;
    });

    var purchaseId = transaction();
    logger.info('Purchases', 'Purchase created: ' + data.invoice_no + (isDecoy ? ' [DECOY]' : ''));
    return getPurchaseById(purchaseId, isDecoy);
}

/**
 * Delete purchase (soft)
 */
function deletePurchase(id, isDecoy) {
    var purchase = getPurchaseById(id, isDecoy);
    if (!purchase) return false;

    var transaction = db.transaction(function() {
        // Mark purchase as deleted
        db.prepare('UPDATE purchases SET is_deleted = 1, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(id);

        // Roll back supplier balance
        if (purchase.supplier_account_id) {
            var outstanding = purchase.total - (purchase.amount_paid || 0);
            db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                .run(outstanding, purchase.supplier_account_id);
            
            // Roll back asset balance if paid
            if (purchase.amount_paid > 0) {
                var assetAccount = accountsService.getDefaultCashAccount(isDecoy);
                if (assetAccount) {
                    db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                        .run(purchase.amount_paid, assetAccount.id);
                }
            }
        }

        // Mark associated transactions as deleted
        db.prepare('UPDATE transactions SET is_deleted = 1 WHERE linked_purchase_id = ?').run(id);

        // Mark associated payments as deleted
        db.prepare('UPDATE payments SET is_deleted = 1 WHERE purchase_id = ?').run(id);

        return true;
    });

    transaction();
    logger.info('Purchases', 'Purchase deleted: ID ' + id + (isDecoy ? ' [DECOY]' : ''));
    return true;
}

module.exports = {
    listPurchases,
    getPurchaseById,
    createPurchase,
    deletePurchase
};
