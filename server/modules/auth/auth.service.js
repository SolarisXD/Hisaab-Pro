/**
 * Auth Service — Hisaab Pro
 * 
 * Handles user authentication: login, password hashing, user creation.
 * Phase 2: Single password. Phase 3 will add dual-password (real/decoy) logic.
 */

'use strict';

var bcrypt = require('bcryptjs');
var { db } = require('../../db/database');
var fs = require('fs').promises;
var path = require('path');
var logger = require('../../shared/logger');
var configLoader = require('../../config');
var configPath = path.join(__dirname, '../../../config.json');
var SALT_ROUNDS = 10;
var MAX_FAILED_LOGINS = 5;

/**
 * Create a new user
 */
function createUser(username, password, role) {
    role = role || 'owner';
    var hash = bcrypt.hashSync(password, SALT_ROUNDS);

    var stmt = db.prepare(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
    );

    try {
        var result = stmt.run(username, hash, role);
        logger.info('Auth', 'User created: ' + username);
        return { id: result.lastInsertRowid, username: username, role: role };
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            throw new Error('Username already exists');
        }
        throw err;
    }
}

/**
 * Authenticate a user by username and password
 * Returns user object if valid, null if invalid
 */
function login(username, password, ip) {
    var user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
    
    // Check if system is nuked
    var state = getSecurityState();
    if (state.is_nuked) {
        throw new Error('System security lockout. Please contact administrator.');
    }

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        incrementFailedLogins();
        logger.warn('Auth', 'Login failed for user: ' + username + ' from IP: ' + ip);
        throw new Error('Invalid username or password');
    }

    // Success - reset failed logins
    resetFailedLogins();

    var isDecoy = user.is_decoy === 1;
    if (isDecoy) {
        logger.info('Auth', 'Decoy login detected for user: ' + username + ' (ID: ' + user.id + ')');
    }

    logActivity(user.id, 'login', 'user', user.id, isDecoy ? 'DECOY MODE' : 'REAL MODE', ip);
    
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        is_decoy: isDecoy
    };
}

/**
 * Security State Helpers
 */
function getSecurityState() {
    return db.prepare('SELECT * FROM security_state WHERE id = 1').get();
}

function incrementFailedLogins() {
    db.prepare('UPDATE security_state SET failed_logins = failed_logins + 1, last_failure_at = datetime(\'now\', \'localtime\'), updated_at = datetime(\'now\', \'localtime\') WHERE id = 1').run();
    
    var state = getSecurityState();
    if (state.failed_logins >= MAX_FAILED_LOGINS) {
        triggerAutoWipe();
    }
}

function resetFailedLogins() {
    db.prepare('UPDATE security_state SET failed_logins = 0, updated_at = datetime(\'now\', \'localtime\') WHERE id = 1').run();
}

function triggerAutoWipe() {
    logger.error('Security', 'CRITICAL: Auto-wipe triggered due to multiple failed login attempts!');
    
    // Record order: transactions -> payments -> sales -> accounts
    var tables = ['transactions', 'payments', 'sales', 'accounts', 'activity_log'];
    
    var transaction = db.transaction(function() {
        for (var table of tables) {
            db.prepare('DELETE FROM ' + table + ' WHERE is_decoy = 0').run();
        }
        db.prepare('UPDATE security_state SET is_nuked = 1, updated_at = datetime(\'now\', \'localtime\') WHERE id = 1').run();
    });
    
    transaction();
    
    logger.error('Security', 'Auto-wipe complete. All real data has been purged.');
}

/**
 * Change user's password
 */
function changePassword(userId, oldPassword, newPassword) {
    var stmt = db.prepare('SELECT password_hash FROM users WHERE id = ?');
    var user = stmt.get(userId);

    if (!user) {
        throw new Error('User not found');
    }

    var valid = bcrypt.compareSync(oldPassword, user.password_hash);
    if (!valid) {
        throw new Error('Current password is incorrect');
    }

    var hash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
    var update = db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?');
    update.run(hash, userId);

    logger.info('Auth', 'Password changed for user ID: ' + userId);
    return true;
}

/**
 * Get user by ID
 */
function getUserById(userId) {
    var stmt = db.prepare('SELECT id, username, role, is_decoy, created_at FROM users WHERE id = ? AND is_active = 1');
    return stmt.get(userId);
}

/**
 * Log an activity (audit trail)
 */
function logActivity(userId, action, entityType, entityId, details, ipAddress) {
    var isDecoy = 0;
    try {
        if (userId) {
            var user = db.prepare('SELECT is_decoy FROM users WHERE id = ?').get(userId);
            if (user) isDecoy = user.is_decoy;
        }
    } catch (e) {}

    var stmt = db.prepare(
        'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address, is_decoy) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(userId, action, entityType || null, entityId || null, details || null, ipAddress || null, isDecoy);
}

function getUserCount() {
    return db.prepare('SELECT count(*) as count FROM users').get().count;
}

module.exports = {
    createUser: createUser,
    login: login,
    changePassword: changePassword,
    getUserById: getUserById,
    logActivity: logActivity,
    getSecurityState: getSecurityState,
    resetFailedLogins: resetFailedLogins,
    triggerAutoWipe: triggerAutoWipe,
    getUserCount: getUserCount,
    isFirstTime: async function() {
        const count = db.prepare('SELECT count(*) as count FROM users').get();
        return count.count === 0;
    },
    signup: async function(shopDetails, ownerUser) {
        // 1. Create User
        const hashedPassword = await bcrypt.hash(ownerUser.password, 10);
        db.prepare(`
            INSERT INTO users (username, password_hash, role, created_at)
            VALUES (?, ?, 'OWNER', CURRENT_TIMESTAMP)
        `).run(ownerUser.username, hashedPassword);

        // 2. Update config.json
        const configData = JSON.parse(await fs.readFile(configPath, 'utf8'));
        configData.shop = {
            name: shopDetails.name,
            address: shopDetails.address,
            phone: shopDetails.phone,
            gstin: shopDetails.gstin || ''
        };
        await fs.writeFile(configPath, JSON.stringify(configData, null, 4));

        // Reload the in-memory config
        if (configLoader.reloadConfig) {
            configLoader.reloadConfig();
        }

        // 3. Initialize default accounts
        const accountsCount = db.prepare('SELECT count(*) as count FROM accounts').get();
        if (accountsCount.count === 0) {
            db.prepare("INSERT INTO accounts (name, type, balance) VALUES ('Cash in Hand', 'cash', 0)").run();
            db.prepare("INSERT INTO accounts (name, type, balance) VALUES ('Main Bank Account', 'bank', 0)").run();
        }

        return { success: true };
    }
};
