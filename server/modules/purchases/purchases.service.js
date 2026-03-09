/**
 * Purchases Service — Hisaab Pro
 * 
 * Simplified CRUD for purchases (Supplier focused).
 */

'use strict';

var { db } = require('../../db/database');
var logger = require('../../shared/logger');

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

    return db.prepare(sql).all(...params);
}

/**
 * Get purchase by ID
 */
function getPurchaseById(id, isDecoy) {
    return db.prepare(
        'SELECT p.*, a.name as supplier_name FROM purchases p' +
        ' LEFT JOIN accounts a ON p.supplier_account_id = a.id' +
        ' WHERE p.id = ? AND p.is_decoy = ? AND p.is_deleted = 0'
    ).get(id, isDecoy ? 1 : 0);
}

/**
 * Create purchase
 */
function createPurchase(data, isDecoy) {
    var total = data.total || 0;
    var amountPaid = data.amount_paid || 0;

    var insertPurchase = db.prepare(
        'INSERT INTO purchases (invoice_no, date, supplier_account_id, total, amount_paid, status, ref_no, notes, is_decoy)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    var transaction = db.transaction(function() {
        var result = insertPurchase.run(
            data.invoice_no,
            data.date || new Date().toISOString().split('T')[0],
            data.supplier_account_id || null,
            total,
            amountPaid,
            amountPaid >= total ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending'),
            data.ref_no || null,
            data.notes || null,
            isDecoy ? 1 : 0
        );

        var purchaseId = result.lastInsertRowid;

        // Update supplier balance (increase our liability/debt to them)
        if (data.supplier_account_id) {
            var outstandingAmount = total - amountPaid;
            // Liability increases for us = they become more of a creditor (negative balance if we use customer-positive convention?)
            // Usually Creditors have Credit balance. Let's assume current_balance is "Net Owed to Us".
            // So Purchase increases liability => current_balance decreases.
            db.prepare('UPDATE accounts SET current_balance = current_balance - ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                .run(outstandingAmount, data.supplier_account_id);

            // Record transaction
            db.prepare(
                'INSERT INTO transactions (date, account_id, type, amount, description, linked_purchase_id, is_decoy)' +
                ' VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(
                data.date || new Date().toISOString().split('T')[0],
                data.supplier_account_id,
                'credit', // Credit the supplier
                total,
                'Purchase ' + data.invoice_no,
                purchaseId,
                isDecoy ? 1 : 0
            );
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
        }

        // Mark associated transactions as deleted
        db.prepare('UPDATE transactions SET is_deleted = 1 WHERE linked_purchase_id = ?').run(id);

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
