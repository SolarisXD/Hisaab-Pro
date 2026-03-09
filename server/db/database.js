/**
 * Database Adapter — Hisaab Pro
 * 
 * Opens/creates the SQLite database and runs the schema.
 * This is the single file to swap when upgrading to SQLCipher (Phase 3)
 * or PostgreSQL (Tier 2).
 */

'use strict';

const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Resolve database path from config
const dbPath = path.resolve(__dirname, '../../', config.database.path);
const dbDir = path.dirname(dbPath);

// Ensure the data directory exists
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Open (or create) the database
const db = new Database(dbPath);

// Enable Encryption (SQLCipher)
// In a real app, this key should be managed securely
const dbKey = config.database_key || 'hisaab-pro-default-key-2026';

try {
    // Set the key BEFORE any other operation
    db.pragma(`key = '${dbKey}'`);
    
    // Force header creation for new files by doing a write or dummy exec
    db.exec('PRAGMA user_version = 1');
} catch (err) {
    console.error('[DB] Encryption Error:', err.message);
    throw err;
}

// Enable foreign key enforcement
db.pragma('foreign_keys = ON');

// Note: WAL mode can sometimes be finicky with SQLCipher on certain platforms
// If you encounter issues, Disable it or use journal_mode = DELETE
try {
    db.pragma('journal_mode = WAL');
} catch (e) {
    console.warn('[DB] WAL mode failed, falling back to default journal mode.');
}

/**
 * Initialize the database schema from schema.sql
 * Uses IF NOT EXISTS so it's safe to run multiple times.
 */
function initializeSchema() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute each statement separately (better-sqlite3 exec runs multiple)
    db.exec(schema);

    console.log('[DB] Schema initialized successfully');
}

/**
 * Get the database instance
 * @returns {Database} better-sqlite3 database instance
 */
function getDb() {
    return db;
}

/**
 * Close the database connection gracefully
 */
function closeDb() {
    db.close();
    console.log('[DB] Connection closed');
}

// Initialize schema on first load
initializeSchema();

module.exports = {
    db,
    getDb,
    closeDb,
    initializeSchema
};
