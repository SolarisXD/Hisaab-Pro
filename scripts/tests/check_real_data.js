const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');

const dbPath = path.resolve('./data/hisaab.db');
const dbKey = 'hisaab-pro-default-key-2026';

try {
    const db = new Database(dbPath);
    db.pragma(`key = '${dbKey}'`);
    
    console.log('--- Real Accounts ---');
    const realAccounts = db.prepare('SELECT id, name, type FROM accounts WHERE is_decoy = 0').all();
    console.log(JSON.stringify(realAccounts, null, 2));

    console.log('\n--- Admin User ---');
    const admin = db.prepare('SELECT id, username, is_active, is_decoy FROM users WHERE username = "admin"').get();
    console.log(JSON.stringify(admin, null, 2));

    db.close();
} catch (err) {
    console.error('Error:', err.message);
}
