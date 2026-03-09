/**
 * Accounts Service — Hisaab Pro
 * 
 * CRUD operations for the Chart of Accounts.
 * Types: customer, supplier, cash, bank, expense, revenue
 */

'use strict';

var { db } = require('../../db/database');
var logger = require('../../shared/logger');

/**
 * List accounts with optional type filter
 */
function listAccounts(filters, isDecoy) {
    filters = filters || {};
    var conditions = ['is_active = 1', 'is_decoy = ?'];
    var params = [isDecoy ? 1 : 0];

    if (filters.type) {
        conditions.push('type = ?');
        params.push(filters.type);
    }
    if (filters.search) {
        conditions.push('(name LIKE ? OR phone LIKE ?)');
        params.push('%' + filters.search + '%');
        params.push('%' + filters.search + '%');
    }

    var sql = 'SELECT * FROM accounts WHERE ' + conditions.join(' AND ') + ' ORDER BY type, name';
    return db.prepare(sql).all.apply(db.prepare(sql), params);
}

/**
 * Get single account by ID
 */
function getAccountById(id, isDecoy) {
    return db.prepare('SELECT * FROM accounts WHERE id = ? AND is_decoy = ? AND is_active = 1').get(id, isDecoy ? 1 : 0);
}

/**
 * Create a new account
 */
function createAccount(data, isDecoy) {
    if (!data.name) throw new Error('Account name is required');
    if (!data.type) throw new Error('Account type is required');

    var validTypes = ['customer', 'supplier', 'cash', 'bank', 'expense', 'revenue'];
    if (validTypes.indexOf(data.type) === -1) {
        throw new Error('Invalid account type. Must be one of: ' + validTypes.join(', '));
    }

    var openingBalance = data.opening_balance || 0;

    var result = db.prepare(
        'INSERT INTO accounts (name, type, phone, address, opening_balance, current_balance, account_group, notes, is_decoy)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
        data.name,
        data.type,
        data.phone || null,
        data.address || null,
        openingBalance,
        openingBalance,
        data.account_group || null,
        data.notes || null,
        isDecoy ? 1 : 0
    );

    logger.info('Accounts', 'Account created: ' + data.name + ' (' + data.type + ')' + (isDecoy ? ' [DECOY]' : ''));
    return getAccountById(result.lastInsertRowid, isDecoy);
}

/**
 * Update an account
 */
function updateAccount(id, data, isDecoy) {
    var existing = getAccountById(id, isDecoy);
    if (!existing) throw new Error('Account not found');

    db.prepare(
        'UPDATE accounts SET name = ?, phone = ?, address = ?, account_group = ?, notes = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?'
    ).run(
        data.name || existing.name,
        data.phone !== undefined ? data.phone : existing.phone,
        data.address !== undefined ? data.address : existing.address,
        data.account_group !== undefined ? data.account_group : existing.account_group,
        data.notes !== undefined ? data.notes : existing.notes,
        id
    );

    logger.info('Accounts', 'Account updated: ID ' + id + (isDecoy ? ' [DECOY]' : ''));
    return getAccountById(id, isDecoy);
}

/**
 * Soft delete an account (deactivate)
 */
function deleteAccount(id, isDecoy) {
    db.prepare('UPDATE accounts SET is_active = 0, updated_at = datetime(\'now\', \'localtime\') WHERE id = ? AND is_decoy = ?').run(id, isDecoy ? 1 : 0);
    logger.info('Accounts', 'Account deactivated: ID ' + id + (isDecoy ? ' [DECOY]' : ''));
    return true;
}

/**
 * Get transaction history for an account
 */
function getAccountTransactions(accountId, filters, isDecoy) {
    filters = filters || {};
    var conditions = ['account_id = ?', 'is_decoy = ?'];
    var params = [accountId, isDecoy ? 1 : 0];

    if (filters.date_from) {
        conditions.push('date >= ?');
        params.push(filters.date_from);
    }
    if (filters.date_to) {
        conditions.push('date <= ?');
        params.push(filters.date_to);
    }

    var sql = 'SELECT * FROM transactions WHERE ' + conditions.join(' AND ') +
        ' ORDER BY date DESC, id DESC';

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
 * Get summary of all accounts grouped by type
 */
function getAccountsSummary(isDecoy) {
    var stmt = db.prepare(
        'SELECT type,' +
        ' COUNT(*) as count,' +
        ' COALESCE(SUM(current_balance), 0) as total_balance' +
        ' FROM accounts WHERE is_active = 1 AND is_decoy = ?' +
        ' GROUP BY type'
    );
    return stmt.all(isDecoy ? 1 : 0);
}

/**
 * Get total debtors (customers with positive balances)
 */
function getTotalDebtors(isDecoy) {
    var stmt = db.prepare(
        'SELECT COALESCE(SUM(current_balance), 0) as total' +
        ' FROM accounts WHERE type = \'customer\' AND current_balance > 0 AND is_active = 1 AND is_decoy = ?'
    );
    return stmt.get(isDecoy ? 1 : 0).total;
}

/**
 * Get total creditors (suppliers with positive balances)
 */
function getTotalCreditors(isDecoy) {
    var stmt = db.prepare(
        'SELECT COALESCE(SUM(current_balance), 0) as total' +
        ' FROM accounts WHERE type = \'supplier\' AND current_balance > 0 AND is_active = 1 AND is_decoy = ?'
    );
    return stmt.get(isDecoy ? 1 : 0).total;
}

/**
 * Get cash and bank balances
 */
function getCashBankBalances(isDecoy) {
    var stmt = db.prepare(
        'SELECT type, name, current_balance FROM accounts' +
        ' WHERE type IN (\'cash\', \'bank\') AND is_active = 1 AND is_decoy = ?'
    );
    return stmt.all(isDecoy ? 1 : 0);
}

module.exports = {
    listAccounts: listAccounts,
    getAccountById: getAccountById,
    createAccount: createAccount,
    updateAccount: updateAccount,
    deleteAccount: deleteAccount,
    getAccountTransactions: getAccountTransactions,
    getAccountsSummary: getAccountsSummary,
    getTotalDebtors: getTotalDebtors,
    getTotalCreditors: getTotalCreditors,
    getCashBankBalances: getCashBankBalances
};
