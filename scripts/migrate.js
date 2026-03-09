/**
 * Migration script to apply schema updates
 */
'use strict';

const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const config = require('./server/config');

const dbPath = path.resolve(__dirname, './', config.database.path);
const db = new Database(dbPath);
const dbKey = config.database_key || 'hisaab-pro-default-key-2026';

try {
    db.pragma(`key = '${dbKey}'`);
    db.pragma('foreign_keys = OFF'); // Disable during migration

    // Add columns one by one (ignore errors if they already exist)
    const migrations = [
        "ALTER TABLE accounts ADD COLUMN account_group TEXT;",
        "ALTER TABLE sales ADD COLUMN ref_no TEXT;",
        "ALTER TABLE payments ADD COLUMN ref_no TEXT;",
        "ALTER TABLE payments ADD COLUMN purchase_id INTEGER;",
        "ALTER TABLE transactions ADD COLUMN linked_purchase_id INTEGER;"
    ];

    for (const sql of migrations) {
        try {
            db.exec(sql);
            console.log(`[Success] ${sql}`);
        } catch (err) {
            if (err.message.includes('duplicate column name')) {
                console.log(`[Skipped] ${sql} (already exists)`);
            } else {
                console.error(`[Error] ${sql}: ${err.message}`);
            }
        }
    }

    // Initialize new tables (handled by initializeSchema in database.js normally, but we run it here too)
    const schemaPath = path.join(__dirname, 'server/db/schema.sql');
    const schema = require('fs').readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    console.log('Migration complete.');
} catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
} finally {
    db.close();
}
