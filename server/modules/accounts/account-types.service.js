/**
 * Account Types Service — Hisaab Pro
 * 
 * CRUD operations for dynamic account types.
 */

'use strict';

var { db } = require('../../db/database');
var logger = require('../../shared/logger');

/**
 * List all account types
 */
function listAccountTypes(includeInactive) {
    var sql = 'SELECT * FROM account_types';
    if (!includeInactive) {
        sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY is_system DESC, name ASC';
    return db.prepare(sql).all();
}

/**
 * Get single account type by ID or Slug
 */
function getAccountType(idOrSlug) {
    if (typeof idOrSlug === 'number' || !isNaN(idOrSlug)) {
        return db.prepare('SELECT * FROM account_types WHERE id = ?').get(idOrSlug);
    }
    return db.prepare('SELECT * FROM account_types WHERE slug = ?').get(idOrSlug);
}

/**
 * Create a new account type
 */
function createAccountType(data) {
    if (!data.name) throw new Error('Account type name is required');
    
    var slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Check if slug already exists
    var existing = getAccountType(slug);
    if (existing) throw new Error('Account type with this name/slug already exists');

    var result = db.prepare(
        'INSERT INTO account_types (name, slug, icon, is_system, is_active) VALUES (?, ?, ?, ?, ?)'
    ).run(
        data.name,
        slug,
        data.icon || 'user',
        0, // New types are never system types
        1
    );

    logger.info('Accounts', 'Account type created: ' + data.name);
    return getAccountType(result.lastInsertRowid);
}

/**
 * Update an account type
 */
function updateAccountType(id, data) {
    var existing = getAccountType(id);
    if (!existing) throw new Error('Account type not found');
    if (existing.is_system && data.slug && data.slug !== existing.slug) {
        throw new Error('Cannot change slug of system account types');
    }

    db.prepare(
        'UPDATE account_types SET name = ?, icon = ?, is_active = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?'
    ).run(
        data.name || existing.name,
        data.icon || existing.icon,
        data.is_active !== undefined ? data.is_active : existing.is_active,
        id
    );

    logger.info('Accounts', 'Account type updated: ' + (data.name || existing.name));
    return getAccountType(id);
}

/**
 * Delete an account type
 */
function deleteAccountType(id) {
    var existing = getAccountType(id);
    if (!existing) throw new Error('Account type not found');
    if (existing.is_system) throw new Error('Cannot delete system account types');

    // Check if any accounts use this type
    var count = db.prepare('SELECT COUNT(*) as count FROM accounts WHERE type = ?').get(existing.slug).count;
    if (count > 0) throw new Error('Cannot delete type that is currently in use by ' + count + ' accounts');

    db.prepare('DELETE FROM account_types WHERE id = ?').run(id);
    logger.info('Accounts', 'Account type deleted: ' + existing.name);
    return true;
}

module.exports = {
    listAccountTypes,
    getAccountType,
    createAccountType,
    updateAccountType,
    deleteAccountType
};
