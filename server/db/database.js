/**
 * Database Adapter — Hisaab Pro
/**
 * Database Adapter — Hisaab Pro
 * 
 * Manages dynamic SQLite database connections to support multiple 
 * financial years (each year is a totally isolated SQLite file).
 */

'use strict';
const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');
let config = require('../config');

const asyncLocalStorage = new AsyncLocalStorage();

// Cache of open database connections: Map<filename, DatabaseInstance>
const dbInstances = new Map();

/**
 * Ensures the 'data' directory exists.
 */
function ensureDataDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Open (or create) a specific database file.
 * Automatically runs schema init if it's a new or uninitialized file.
 */
function getDbInstance(filename) {
    if (dbInstances.has(filename)) {
        return dbInstances.get(filename);
    }

    // Construct full path
    const basePath = path.resolve(__dirname, '../../', config.database.path);
    const dbDir = path.dirname(basePath);
    const dbPath = path.join(dbDir, filename);
    
    ensureDataDir(dbPath);

    console.log(`[DB] Opening database: ${filename}`);
    const db = new Database(dbPath);
    const dbKey = config.database_key || 'hisaab-pro-default-key-2026';

    try {
        db.pragma(`key = '${dbKey}'`);
        db.exec('PRAGMA user_version = 1');
    } catch (err) {
        console.error(`[DB] Encryption Error on ${filename}:`, err.message);
        throw err;
    }

    db.pragma('foreign_keys = ON');

    try {
        db.pragma('journal_mode = WAL');
    } catch (e) {
        console.warn('[DB] WAL mode failed, falling back to default journal mode.');
    }

    dbInstances.set(filename, db);

    // Run schema migrations on this newly opened database
    initializeSchema(db, filename);

    return db;
}

/**
 * Initialize the database schema from schema.sql
 */
function initializeSchema(db, filename) {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    db.exec(schema);

    // One-time migrations for existing databases
    try {
        db.exec("ALTER TABLE transactions ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0");
        console.log(`[DB] Migration: Added is_deleted to transactions for ${filename}`);
        
        db.exec("UPDATE transactions SET is_deleted = 1 WHERE linked_sale_id IN (SELECT id FROM sales WHERE is_deleted = 1)");
        db.exec("UPDATE transactions SET is_deleted = 1 WHERE linked_payment_id IN (SELECT id FROM payments WHERE is_deleted = 1)");
        db.exec("UPDATE transactions SET is_deleted = 1 WHERE linked_purchase_id IN (SELECT id FROM purchases WHERE is_deleted = 1)");
    } catch (e) {
        try {
            db.exec("UPDATE transactions SET is_deleted = 1 WHERE linked_sale_id IN (SELECT id FROM sales WHERE is_deleted = 1) AND is_deleted = 0");
            db.exec("UPDATE transactions SET is_deleted = 1 WHERE linked_payment_id IN (SELECT id FROM payments WHERE is_deleted = 1) AND is_deleted = 0");
            db.exec("UPDATE transactions SET is_deleted = 1 WHERE linked_purchase_id IN (SELECT id FROM purchases WHERE is_deleted = 1) AND is_deleted = 0");
        } catch (inner) {}
    }

    try { db.exec("ALTER TABLE accounts ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE sales ADD COLUMN images TEXT DEFAULT '[]'"); } catch (e) {}
    try { db.exec("ALTER TABLE purchases ADD COLUMN images TEXT DEFAULT '[]'"); } catch (e) {}
    try { db.exec("ALTER TABLE purchases ADD COLUMN subtotal REAL DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE purchases ADD COLUMN tax_percent REAL DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE purchases ADD COLUMN tax_amount REAL DEFAULT 0"); } catch (e) {}
    
    console.log(`[DB] Schema check completed for ${filename}`);

    // Seed initial account types if empty
    try {
        const count = db.prepare("SELECT COUNT(*) as count FROM account_types").get().count;
        if (count === 0) {
            const seedTypes = [
                ['Customer', 'customer', 'person', 1],
                ['Supplier', 'supplier', 'factory', 1],
                ['Cash', 'cash', 'payments', 1],
                ['Bank', 'bank', 'account_balance', 1],
                ['Expense', 'expense', 'trending_up', 1],
                ['Revenue', 'revenue', 'trending_down', 1]
            ];
            const stmt = db.prepare("INSERT INTO account_types (name, slug, icon, is_system) VALUES (?, ?, ?, ?)");
            seedTypes.forEach(t => stmt.run(t));
        }
        
        // Add Staff account type if missing
        const staffCount = db.prepare("SELECT COUNT(*) as count FROM account_types WHERE slug = 'staff'").get().count;
        if (staffCount === 0) {
            db.prepare("INSERT INTO account_types (name, slug, icon, is_system) VALUES ('Staff/Employee', 'staff', 'account_circle', 1)").run();
        }
    } catch (e) { }
}

// -----------------------------------------------------------------------------
// The Magic Proxy
// -----------------------------------------------------------------------------
// Intercepts all property accesses and routes to the request-specific DB instance.
const proxyDb = new Proxy({}, {
    get: function(target, prop) {
        config = require('../config');
        // Determine filename from AsyncContext OR fallback to Global Active DB
        const contextFilename = asyncLocalStorage.getStore();
        const filename = contextFilename || config.database.active_database || path.basename(config.database.path) || 'hisaab.db';
        const dbInstance = getDbInstance(filename);
        
        const value = dbInstance[prop];
        if (typeof value === 'function') {
            return value.bind(dbInstance);
        }
        return value;
    }
});

/**
 * Wrapper to run a function within a specific DB context
 */
function fyRequestContext(filename, callback) {
    return asyncLocalStorage.run(filename, callback);
}

function getDb() {
    return proxyDb;
}

// Global active database switch (mostly for backup scripts or old global ref)
function switchDatabase(filename) {
    config = require('../config');
    config.database.active_database = filename;
    return getDbInstance(filename);
}

function getCurrentDatabaseFilename() {
    config = require('../config');
    return asyncLocalStorage.getStore() || config.database.active_database || 'hisaab.db';
}

function closeDb() {
    for (const [filename, db] of dbInstances.entries()) {
        try { 
            db.close(); 
            console.log(`[DB] Closed ${filename}`);
        } catch(e) {}
    }
    dbInstances.clear();
}

module.exports = {
    db: proxyDb,
    getDb,
    switchDatabase,
    getCurrentDatabaseFilename,
    closeDb,
    fyRequestContext
};
