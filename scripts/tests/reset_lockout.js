const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');

const dbPath = path.resolve('./data/hisaab.db');
const dbKey = 'hisaab-pro-default-key-2026';

try {
    const db = new Database(dbPath);
    db.pragma(`key = '${dbKey}'`);
    
    console.log('Resetting security state...');
    db.prepare('UPDATE security_state SET is_nuked = 0, failed_logins = 0 WHERE id = 1').run();
    
    const state = db.prepare('SELECT * FROM security_state WHERE id = 1').get();
    console.log('New State:', JSON.stringify(state, null, 2));

    db.close();
    console.log('Done.');
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
