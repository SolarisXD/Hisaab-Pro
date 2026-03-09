const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');

const dbPath = path.resolve('./data/hisaab.db');
const dbKey = 'hisaab-pro-default-key-2026';

try {
    const db = new Database(dbPath);
    db.pragma(`key = '${dbKey}'`);
    
    const tables = ['accounts', 'sales', 'transactions', 'payments'];
    for (const table of tables) {
        const count = db.prepare(`SELECT count(*) as count FROM ${table} WHERE is_decoy = 0`).get().count;
        const decoyCount = db.prepare(`SELECT count(*) as count FROM ${table} WHERE is_decoy = 1`).get().count;
        console.log(`${table}: Real=${count}, Decoy=${decoyCount}`);
    }

    db.close();
} catch (err) {
    console.error('Error:', err.message);
}
