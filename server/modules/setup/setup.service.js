/**
 * Setup Service - Hisaab Pro
 * 
 * Handles first-run setup logic including admin user creation,
 * shop configuration, and initial financial year creation.
 */

'use strict';

var bcrypt = require('bcryptjs');
var db = require('../../db/database').db;
var config = require('../../config');
var fs = require('fs');
var path = require('path');

var SALT_ROUNDS = 10;

/**
 * Check if setup is required (no users exist)
 */
function isSetupRequired() {
    try {
        var result = db.prepare('SELECT COUNT(*) as count FROM users').get();
        return result.count === 0;
    } catch (err) {
        return true;
    }
}

/**
 * Check if shop configuration exists
 */
function isShopConfigured() {
    return config.shop && config.shop.name && config.shop.name !== 'My Shop';
}

/**
 * Create admin user
 */
function createAdminUser(username, password) {
    var passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
    
    var stmt = db.prepare(
        'INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, ?)'
    );
    
    var result = stmt.run(username, passwordHash, 'owner', 1);
    return result.lastInsertRowid;
}

/**
 * Update shop configuration
 */
function updateShopConfig(shopData) {
    try {
        var configPath = path.join(__dirname, '../../../config.json');
        var rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        rawConfig.shop = Object.assign(rawConfig.shop || {}, {
            name: shopData.name || 'My Shop',
            address: shopData.address || '',
            phone: shopData.phone || '',
            gstin: shopData.gstin || ''
        });
        
        if (shopData.currency) rawConfig.currency = shopData.currency;
        if (shopData.currency_symbol) rawConfig.currency_symbol = shopData.currency_symbol;
        if (shopData.tax_rate !== undefined) rawConfig.tax_rate = parseFloat(shopData.tax_rate);
        if (shopData.invoice_prefix) rawConfig.invoice_prefix = shopData.invoice_prefix;
        if (shopData.locale) rawConfig.locale = shopData.locale;
        
        fs.writeFileSync(configPath, JSON.stringify(rawConfig, null, 2), 'utf-8');
        
        delete require.cache[require.resolve('../../config')];
        return true;
    } catch (err) {
        console.error('[Setup] Failed to update config:', err.message);
        return false;
    }
}

/**
 * Create initial financial year
 */
function createInitialFinancialYear(startDate, endDate, name) {
    try {
        var dbModule = require('../../db/database');
        var crypto = require('crypto');
        
        var timestamp = Date.now();
        var random = crypto.randomBytes(4).toString('hex');
        var dbFilename = 'hisaab_' + name.replace('-', '_') + '_' + timestamp + '_' + random + '.db';
        
        dbModule.getDbInstance(dbFilename);
        
        var configPath = path.join(__dirname, '../../../config.json');
        var rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        if (!rawConfig.financial_years) rawConfig.financial_years = [];
        
        rawConfig.financial_years.push({
            id: Date.now(),
            name: name,
            start_date: startDate,
            end_date: endDate,
            db_filename: dbFilename
        });
        
        rawConfig.database.active_database = dbFilename;
        
        fs.writeFileSync(configPath, JSON.stringify(rawConfig, null, 2), 'utf-8');
        
        return {
            success: true,
            db_filename: dbFilename,
            name: name
        };
    } catch (err) {
        console.error('[Setup] Failed to create financial year:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Complete setup process
 */
function completeSetup(setupData) {
    try {
        var userId = createAdminUser(setupData.username, setupData.password);
        
        updateShopConfig(setupData.shop);
        
        var fyResult = createInitialFinancialYear(
            setupData.financial_year.start_date,
            setupData.financial_year.end_date,
            setupData.financial_year.name
        );
        
        if (!fyResult.success) {
            throw new Error('Failed to create financial year: ' + fyResult.error);
        }
        
        return {
            success: true,
            user_id: userId,
            financial_year: fyResult
        };
    } catch (err) {
        console.error('[Setup] Setup failed:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

module.exports = {
    isSetupRequired: isSetupRequired,
    isShopConfigured: isShopConfigured,
    createAdminUser: createAdminUser,
    updateShopConfig: updateShopConfig,
    createInitialFinancialYear: createInitialFinancialYear,
    completeSetup: completeSetup
};
