const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');

const dbPath = path.resolve('./data/hisaab.db');
const dbKey = 'hisaab-pro-default-key-2026';

try {
    const db = new Database(dbPath);
    db.pragma(`key = '${dbKey}'`);
    
    console.log('--- Users ---');
    const users = db.prepare('SELECT id, username, role, is_active, is_decoy FROM users').all();
    console.log(JSON.stringify(users, null, 2));

    console.log('\n--- Security State ---');
    const state = db.prepare('SELECT * FROM security_state').all();
    console.log(JSON.stringify(state, null, 2));

    db.close();
} catch (err) {
    console.error('Error:', err.message);
}
