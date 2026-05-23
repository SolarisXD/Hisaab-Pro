/**
 * Mock Config — Hisaab Pro
 * 
 * Mock configuration for Jest tests.
 * This file is used by Jest's moduleNameMapper to mock the config module.
 */

'use strict';

module.exports = {
    shop: {
        name: 'Test Shop',
        address: '123 Test Street',
        phone: '9876543210',
        gstin: 'TEST123456789',
        logo_path: 'assets/logo.png'
    },
    currency: 'INR',
    currency_symbol: '₹',
    tax_rate: 18,
    invoice_prefix: 'INV',
    locale: 'en-IN',
    session: {
        timeout_minutes: 15,
        secret: 'test-session-secret-12345'
    },
    backup: {
        auto_time: '23:00',
        usb_drive_label: 'HISAABPRO_BKP'
    },
    server: {
        port: 3000,
        host: 'localhost'
    },
    database: {
        path: ':memory:',
        active_database: 'test.db',
        database_key: 'test-key-123'
    },
    database_key: 'test-key-123',
    financial_years: [],
    is_production: false
};
