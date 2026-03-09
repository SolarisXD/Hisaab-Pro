/**
 * Config Loader — Hisaab Pro
 * 
 * Loads config.json and provides defaults for optional fields.
 * All shop-specific values are read from here — never hardcoded.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, '../config.json');

let rawConfig = {};

try {
    const configFile = fs.readFileSync(configPath, 'utf-8');
    rawConfig = JSON.parse(configFile);
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
        secret: 'hisaab-pro-default-secret-change-this',
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
    }
};

function reloadConfig() {
    try {
        const configFile = fs.readFileSync(configPath, 'utf-8');
        const newData = JSON.parse(configFile);
        Object.assign(config.shop, newData.shop);
        if (newData.currency) config.currency = newData.currency;
        if (newData.currency_symbol) config.currency_symbol = newData.currency_symbol;
        // ... update other fields as needed
        return true;
    } catch (err) {
        console.error('[Config] Reload failed:', err.message);
        return false;
    }
}

module.exports = config;
module.exports.reloadConfig = reloadConfig;
