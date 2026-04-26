/**
 * Payments Service — Hisaab Pro
 * 
 * CRUD operations for incoming/outgoing payments.
 * Updates account balances and creates transactions.
 */

'use strict';

var { db } = require('../../db/database');
var logger = require('../../shared/logger');
var accountsService = require('../accounts/accounts.service');
var fyValidator = require('../../shared/fy-validator');

/**
 * List payments with optional filters
 */
function listPayments(filters, isDecoy) {
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
    if (filters.account_id) {
        conditions.push('p.account_id = ?');
        params.push(filters.account_id);
    }
    if (filters.type) {
        conditions.push('p.type = ?');
        params.push(filters.type);
    }
    if (filters.mode) {
        conditions.push('p.mode = ?');
        params.push(filters.mode);
    }
    if (filters.search) {
        conditions.push('(a.name LIKE ? OR p.reference LIKE ? OR p.notes LIKE ?)');
        params.push('%' + filters.search + '%');
        params.push('%' + filters.search + '%');
        params.push('%' + filters.search + '%');
    }

    var sql = 'SELECT p.*, a.name as account_name, a.type as account_type, ' +
        ' s.invoice_no as sale_invoice_no, s.total as sale_total, s.amount_paid as sale_amount_paid, s.status as sale_status ' +
        'FROM payments p ' +
        ' LEFT JOIN accounts a ON p.account_id = a.id' +
        ' LEFT JOIN sales s ON p.sale_id = s.id' +
        ' WHERE ' + conditions.join(' AND ') +
        ' ORDER BY p.date DESC, p.id DESC';

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
 * Get a single payment by ID
 */
function getPaymentById(id, isDecoy) {
    return db.prepare(
        'SELECT p.*, a.name as account_name, a.type as account_type, ' +
        ' s.invoice_no as sale_invoice_no, s.total as sale_total, s.amount_paid as sale_amount_paid, s.status as sale_status ' +
        'FROM payments p ' +
        ' LEFT JOIN accounts a ON p.account_id = a.id' +
        ' LEFT JOIN sales s ON p.sale_id = s.id' +
        ' WHERE p.id = ? AND p.is_decoy = ? AND p.is_deleted = 0'
    ).get(id, isDecoy ? 1 : 0);
}

/**
 * Create a new payment
 * type: 'in' (received from customer) or 'out' (paid to supplier)
 * mode: 'cash' | 'bank_transfer' | 'upi' | 'cheque'
 */
function createPayment(data, isDecoy) {
    // 0. Hard Financial Year Validation
    if (!isDecoy) fyValidator.validateTransactionDate(data.date);

    if (!data.account_id) throw new Error('Account is required');
    if (!data.amount || data.amount <= 0) throw new Error('Valid amount is required');
    if (!data.type || (data.type !== 'in' && data.type !== 'out')) throw new Error('Type must be "in" or "out"');

    var transaction = db.transaction(function() {
var result = db.prepare(
            'INSERT INTO payments (date, account_id, amount, type, mode, reference, ref_no, sale_id, notes, is_decoy)' +
            ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
            data.date || new Date().toISOString().split('T')[0],
            data.account_id,
            data.amount,
            data.type,
            data.mode || 'cash',
            data.reference || null,
            data.ref_no || null,
            data.sale_id || null,
            data.notes || null,
            isDecoy ? 1 : 0
        );

        var paymentId = result.lastInsertRowid;

        var partyAccount = accountsService.getAccountById(data.account_id, isDecoy);

        // --- Leg 1: Update Party account (Customer/Supplier) ---
        // 'in' = payment received FROM customer → reduces their debt (decrease balance)
        // 'out' = payment made TO supplier → reduces our liability (increase balance)
        var balanceChange = data.type === 'in' ? -data.amount : data.amount;
        db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
            .run(balanceChange, data.account_id);

        db.prepare(
            'INSERT INTO transactions (date, account_id, type, amount, description, linked_payment_id, is_decoy)' +
            ' VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(
            data.date || new Date().toISOString().split('T')[0],
            data.account_id,
            data.type === 'in' ? 'credit' : 'debit',
            data.amount,
            'Payment ' + (data.type === 'in' ? 'received' : 'made') + ' (' + (data.mode || 'cash') + ')',
            paymentId,
            isDecoy ? 1 : 0
        );

        // --- Leg 2: Update Asset account (Cash/Bank) ---
        var assetAccount = data.mode === 'cash' ? accountsService.getDefaultCashAccount(isDecoy) : accountsService.getDefaultBankAccount(isDecoy);
        if (assetAccount) {
            // 'in' (received FROM customer) -> asset increases (Debit)
            // 'out' (paid TO supplier) -> asset decreases (Credit)
            var assetBalanceChange = data.type === 'in' ? data.amount : -data.amount;
            db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                .run(assetBalanceChange, assetAccount.id);

            db.prepare(
                'INSERT INTO transactions (date, account_id, type, amount, description, linked_payment_id, is_decoy)' +
                ' VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(
                data.date || new Date().toISOString().split('T')[0],
                assetAccount.id,
                data.type === 'in' ? 'debit' : 'credit',
                data.amount,
                'Payment ' + (data.type === 'in' ? 'received' : 'made') + ' from ' + (partyAccount ? partyAccount.name : 'Account #' + data.account_id),
                paymentId,
                isDecoy ? 1 : 0
            );
        }

        // If linked to a sale, update sale's amount_paid
        if (data.sale_id && data.type === 'in') {
            db.prepare(
                'UPDATE sales SET amount_paid = amount_paid + ?, status = CASE WHEN amount_paid + ? >= total THEN \'paid\' ELSE \'partial\' END, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?'
            ).run(data.amount, data.amount, data.sale_id);
        }

        return paymentId;
    });

    var paymentId = transaction();
    logger.info('Payments', 'Payment created: ID ' + paymentId + ' (' + data.type + ' ' + data.amount + ')' + (isDecoy ? ' [DECOY]' : ''));
    return getPaymentById(paymentId, isDecoy);
}

/**
 * Update a payment
 */
function updatePayment(id, data, isDecoy) {
    // 0. Hard Financial Year Validation
    if (!isDecoy && data.date) fyValidator.validateTransactionDate(data.date);

    var existing = getPaymentById(id, isDecoy);
    if (!existing) throw new Error('Payment not found');

    var transaction = db.transaction(function() {
        // Determine the new amount, type, and account_id from data or existing
        var newAmount = data.amount || existing.amount;
        var newType = data.type || existing.type;
        var newAccountId = data.account_id || existing.account_id;
        var newDate = data.date || existing.date;
        var newMode = data.mode || existing.mode;
        var newReference = data.reference !== undefined ? data.reference : existing.reference;
        var newNotes = data.notes !== undefined ? data.notes : existing.notes;

        // --- Rollback old balance and sales ---
        var oldAmount = existing.amount;
        var oldType = existing.type;
        var oldAccountId = existing.account_id;

        // Revert party account balance
        var revertAmount = oldType === 'in' ? oldAmount : -oldAmount;
        db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
            .run(revertAmount, oldAccountId);

        // Revert asset account balance
        var assetAccount = existing.mode === 'cash' ? accountsService.getDefaultCashAccount(isDecoy) : accountsService.getDefaultBankAccount(isDecoy);
        if (assetAccount) {
            var assetRevertAmount = oldType === 'in' ? -oldAmount : oldAmount;
            db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                .run(assetRevertAmount, assetAccount.id);
        }

        // Revert sale's amount_paid if linked and was 'in'
        if (existing.sale_id && oldType === 'in') {
            db.prepare(
                'UPDATE sales SET amount_paid = amount_paid - ?, status = CASE WHEN amount_paid - ? >= total THEN \'paid\' WHEN amount_paid - ? > 0 THEN \'partial\' ELSE \'pending\' END, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?'
            ).run(oldAmount, oldAmount, oldAmount, existing.sale_id);
        }

        // Mark old transactions as deleted
        db.prepare('UPDATE transactions SET is_deleted = 1 WHERE linked_payment_id = ? AND is_decoy = ?').run(id, isDecoy ? 1 : 0);

        // --- Update payment record ---
        db.prepare(
            'UPDATE payments SET date = ?, account_id = ?, amount = ?, type = ?, mode = ?, reference = ?, ref_no = ?, notes = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ? AND is_decoy = ?'
        ).run(
            newDate,
            newAccountId,
            newAmount,
            newType,
            newMode,
            newReference,
            data.ref_no !== undefined ? data.ref_no : existing.ref_no,
            newNotes,
            id,
            isDecoy ? 1 : 0
        );

        // --- Apply new balance and transactions (Double-Entry) ---
        var partyAccount = accountsService.getAccountById(newAccountId, isDecoy);
        
        // Leg 1: Party
        var newBalanceChange = newType === 'in' ? -newAmount : newAmount;
        db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
            .run(newBalanceChange, newAccountId);

        db.prepare(
            'INSERT INTO transactions (date, account_id, type, amount, description, linked_payment_id, is_decoy, is_deleted)' +
            ' VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
        ).run(
            newDate,
            newAccountId,
            newType === 'in' ? 'credit' : 'debit',
            newAmount,
            (newType === 'in' ? 'Payment Received' : 'Payment Made') + ' (Updated)',
            id,
            isDecoy ? 1 : 0
        );

        // Leg 2: Asset
        var newAssetAccount = newMode === 'cash' ? accountsService.getDefaultCashAccount(isDecoy) : accountsService.getDefaultBankAccount(isDecoy);
        if (newAssetAccount) {
            var newAssetBalanceChange = newType === 'in' ? newAmount : -newAmount;
            db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                .run(newAssetBalanceChange, newAssetAccount.id);

            db.prepare(
                'INSERT INTO transactions (date, account_id, type, amount, description, linked_payment_id, is_decoy, is_deleted)' +
                ' VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
            ).run(
                newDate,
                newAssetAccount.id,
                newType === 'in' ? 'debit' : 'credit',
                newAmount,
                (newType === 'in' ? 'Payment Received' : 'Payment Made') + ' from ' + (partyAccount ? partyAccount.name : 'Account #' + newAccountId),
                id,
                isDecoy ? 1 : 0
            );
        }

        // Update sale's amount_paid if linked and is 'in'
        if (existing.sale_id && newType === 'in') {
            db.prepare(
                'UPDATE sales SET amount_paid = amount_paid + ?, status = CASE WHEN amount_paid + ? >= total THEN \'paid\' ELSE \'partial\' END, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?'
            ).run(newAmount, newAmount, existing.sale_id);
        }
    });

    transaction(); // Execute the transaction
    logger.info('Payments', 'Payment updated: ID ' + id + (isDecoy ? ' [DECOY]' : ''));
    return getPaymentById(id, isDecoy);
}

/**
 * Soft delete a payment
 */
function deletePayment(id, isDecoy) {
    var payment = getPaymentById(id, isDecoy);
    if (!payment) return false;

    var transaction = db.transaction(function() {
        // Mark payment as deleted
        db.prepare('UPDATE payments SET is_deleted = 1, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(id);

        // Roll back account balance (opposite of what create did)
        var rollbackAmount = payment.type === 'in' ? payment.amount : -payment.amount;
        db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
            .run(rollbackAmount, payment.account_id);

        // Mark transaction as deleted
        db.prepare('UPDATE transactions SET is_deleted = 1 WHERE linked_payment_id = ?').run(id);

        // If linked to sale, roll back amount_paid
        if (payment.sale_id && payment.type === 'in') {
            db.prepare(
                'UPDATE sales SET amount_paid = amount_paid - ?, status = CASE WHEN amount_paid - ? >= total THEN \'paid\' WHEN amount_paid - ? > 0 THEN \'partial\' ELSE \'pending\' END, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?'
            ).run(payment.amount, payment.amount, payment.amount, payment.sale_id);
        }

        // --- Leg 2: Roll back Asset account (Cash/Bank) ---
        var assetAccount = payment.mode === 'cash' ? accountsService.getDefaultCashAccount(isDecoy) : accountsService.getDefaultBankAccount(isDecoy);
        if (assetAccount) {
            // Revert asset change: opposite of create
            // If create was +amount (type in), rollback is -amount.
            var assetRollback = payment.type === 'in' ? -payment.amount : payment.amount;
            db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                .run(assetRollback, assetAccount.id);
        }

        return true;
    });

    transaction();
    logger.info('Payments', 'Payment deleted: ID ' + id + (isDecoy ? ' [DECOY]' : ''));
    return true;
}

/**
 * Get payment summary for a date range
 */
function getPaymentsSummary(dateFrom, dateTo, isDecoy) {
    var stmt = db.prepare(
        'SELECT type,' +
        ' COUNT(*) as count,' +
        ' COALESCE(SUM(amount), 0) as total' +
        ' FROM payments WHERE date >= ? AND date <= ? AND is_deleted = 0 AND is_decoy = ?' +
        ' GROUP BY type'
    );
    var rows = stmt.all(dateFrom, dateTo, isDecoy ? 1 : 0);
    var summary = { received: { count: 0, total: 0 }, paid: { count: 0, total: 0 } };
    for (var i = 0; i < rows.length; i++) {
        if (rows[i].type === 'in') {
            summary.received = { count: rows[i].count, total: rows[i].total };
        } else {
            summary.paid = { count: rows[i].count, total: rows[i].total };
        }
    }
    return summary;
}

module.exports = {
    listPayments: listPayments,
    getPaymentById: getPaymentById,
    createPayment: createPayment,
    updatePayment: updatePayment,
    deletePayment: deletePayment,
    getPaymentsSummary: getPaymentsSummary
};
