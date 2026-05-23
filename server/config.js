/**
 * Config Loader — Hisaab Pro
 * 
 * Loads config.json and provides defaults for optional fields.
 * All shop-specific values are read from here — never hardcoded.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { appRootDir } = require('./shared/paths');

const configPath = path.join(appRootDir, 'config.json');

let rawConfig = {};

try {
    if (fs.existsSync(configPath)) {
        const configFile = fs.readFileSync(configPath, 'utf-8');
        rawConfig = JSON.parse(configFile);
    }
} catch (err) {
    console.error('[Config] Failed to load config.json:', err.message);
    console.error('[Config] Using default configuration');
}

// Merge with defaults
const config = {
    shop: {
        name: 'My Shop',
        address: '',
        phone: '',
        gstin: '',
        logo_path: 'assets/logo.png',
        ...rawConfig.shop
    },
    currency: rawConfig.currency || 'INR',
    currency_symbol: rawConfig.currency_symbol || '₹',
    tax_rate: rawConfig.tax_rate !== undefined ? rawConfig.tax_rate : 18,
    invoice_prefix: rawConfig.invoice_prefix || 'INV',
    locale: rawConfig.locale || 'en-IN',
    session: {
        timeout_minutes: 15,
        secret: 'PLACEHOLDER',
        ...rawConfig.session
    },
    backup: {
        auto_time: '23:00',
        usb_drive_label: 'HISAABPRO_BKP',
        ...rawConfig.backup
    },
    server: {
        port: 3000,
        host: 'localhost',
        ...rawConfig.server
    },
    database: {
        path: './data/hisaab.db',
        ...rawConfig.database
    },
    database_key: rawConfig.database_key || null,
    financial_years: rawConfig.financial_years || [],
    is_production: rawConfig.is_production || false
};

// ============================================================
// AUTO-GENERATE SESSION SECRET (CRIT-3)
// ============================================================
// If the session secret is still a placeholder or default, generate a real one
var weakSecrets = ['PLACEHOLDER', 'hisaab-pro-default-secret-change-this', 'change-this-to-a-random-secret-key'];
if (weakSecrets.includes(config.session.secret)) {
    var generatedSecret = crypto.randomBytes(64).toString('hex');
    config.session.secret = generatedSecret;
    
    // Persist it to config.json so it stays the same across restarts
    try {
        var rawFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!rawFile.session) rawFile.session = {};
        rawFile.session.secret = generatedSecret;
        fs.writeFileSync(configPath, JSON.stringify(rawFile, null, 2), 'utf-8');
        console.log('[Config] Auto-generated and saved a secure session secret.');
    } catch (e) {
        console.warn('[Config] Could not persist session secret to config.json:', e.message);
    }
}

function reloadConfig() {
    try {
        const configFile = fs.readFileSync(configPath, 'utf-8');
        const newData = JSON.parse(configFile);
        Object.assign(config.shop, newData.shop);
        if (newData.currency) config.currency = newData.currency;
        if (newData.currency_symbol) config.currency_symbol = newData.currency_symbol;
        if (newData.financial_years) config.financial_years = newData.financial_years;
        if (newData.database && newData.database.active_database) {
            config.database.active_database = newData.database.active_database;
        }
        // ... update other fields as needed
        return true;
    } catch (err) {
        console.error('[Config] Reload failed:', err.message);
        return false;
    }
}

module.exports = config;
module.exports.reloadConfig = reloadConfig;
