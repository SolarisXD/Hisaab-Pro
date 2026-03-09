const Database = require('better-sqlite3-multiple-ciphers');
const fs = require('fs');

const testDb = 'test-encrypted.db';
if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

try {
    const db = new Database(testDb);
    console.log('Opened database');
    
    db.pragma("key = 'pass123'");
    console.log('Set key');
    
    db.exec('CREATE TABLE test (id INTEGER)');
    console.log('Created table');
    
    db.prepare('INSERT INTO test (id) VALUES (?)').run(1);
    console.log('Inserted data');
    
    db.close();
    console.log('Closed database');
    
    // Try to open WITHOUT key
    const db2 = new Database(testDb);
    try {
        db2.prepare('SELECT * FROM test').get();
        console.error('ERROR: Could read data WITHOUT key!');
    } catch (e) {
        console.log('SUCCESS: Could not read data without key (expected):', e.message);
    }
    db2.close();
    
    // Try to open WITH key
    const db3 = new Database(testDb);
    db3.pragma("key = 'pass123'");
    try {
        const row = db3.prepare('SELECT * FROM test').get();
        console.log('SUCCESS: Could read data WITH key:', row);
    } catch (e) {
        console.error('ERROR: Could not read data with key:', e.message);
    }
    db3.close();

} catch (err) {
    console.error('FATAL ERROR:', err);
} finally {
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
}
