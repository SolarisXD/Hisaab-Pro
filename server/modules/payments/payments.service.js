/**
 * Payments Service — Hisaab Pro
 * 
 * CRUD operations for incoming/outgoing payments.
 * Updates account balances and creates transactions.
 */

'use strict';

var { db } = require('../../db/database');
var logger = require('../../shared/logger');

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

    var sql = 'SELECT p.*, a.name as account_name, a.type as account_type FROM payments p' +
        ' LEFT JOIN accounts a ON p.account_id = a.id' +
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
        'SELECT p.*, a.name as account_name, a.type as account_type FROM payments p' +
        ' LEFT JOIN accounts a ON p.account_id = a.id' +
        ' WHERE p.id = ? AND p.is_decoy = ? AND p.is_deleted = 0'
    ).get(id, isDecoy ? 1 : 0);
}

/**
 * Create a new payment
 * type: 'in' (received from customer) or 'out' (paid to supplier)
 * mode: 'cash' | 'bank_transfer' | 'upi' | 'cheque'
 */
function createPayment(data, isDecoy) {
    if (!data.account_id) throw new Error('Account is required');
    if (!data.amount || data.amount <= 0) throw new Error('Valid amount is required');
    if (!data.type || (data.type !== 'in' && data.type !== 'out')) throw new Error('Type must be "in" or "out"');

    var transaction = db.transaction(function() {
        var result = db.prepare(
            'INSERT INTO payments (date, account_id, amount, type, mode, reference, sale_id, notes, is_decoy)' +
            ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
            data.date || new Date().toISOString().split('T')[0],
            data.account_id,
            data.amount,
            data.type,
            data.mode || 'cash',
            data.reference || null,
            data.sale_id || null,
            data.notes || null,
            isDecoy ? 1 : 0
        );

        var paymentId = result.lastInsertRowid;

        // Update account balance
        // 'in' = payment received → reduce customer debt (decrease balance)
        // 'out' = payment made → reduce supplier liability (decrease balance)
        var balanceChange = data.type === 'in' ? -data.amount : -data.amount;
        db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
            .run(balanceChange, data.account_id);

        // Record transaction
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
    var existing = getPaymentById(id, isDecoy);
    if (!existing) throw new Error('Payment not found');

    db.prepare(
        'UPDATE payments SET date = ?, amount = ?, mode = ?, reference = ?, notes = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?'
    ).run(
        data.date || existing.date,
        data.amount || existing.amount,
        data.mode || existing.mode,
        data.reference !== undefined ? data.reference : existing.reference,
        data.notes !== undefined ? data.notes : existing.notes,
        id
    );

    logger.info('Payments', 'Payment updated: ID ' + id + (isDecoy ? ' [DECOY]' : ''));
    return getPaymentById(id, isDecoy);
}

/**
 * Soft delete a payment
 */
function deletePayment(id, isDecoy) {
    db.prepare('UPDATE payments SET is_deleted = 1, updated_at = datetime(\'now\', \'localtime\') WHERE id = ? AND is_decoy = ?').run(id, isDecoy ? 1 : 0);
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
