const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');

const dbPath = path.resolve('./data/hisaab.db');
const dbKey = 'hisaab-pro-default-key-2026';

try {
    const db = new Database(dbPath);
    db.pragma(`key = '${dbKey}'`);
    
    console.log('--- Accounts (All) ---');
    const accounts = db.prepare('SELECT id, name, type, is_decoy FROM accounts LIMIT 20').all();
    console.log(JSON.stringify(accounts, null, 2));

    console.log('\n--- Security State ---');
    const state = db.prepare('SELECT * FROM security_state WHERE id = 1').get();
    console.log(JSON.stringify(state, null, 2));

    db.close();
} catch (err) {
    console.error('Error:', err.message);
}
