const Database = require('better-sqlite3-multiple-ciphers');
const db = new Database(':memory:');
db.pragma('key = "testkey"');
db.exec('CREATE TABLE test (val TEXT)');
db.prepare('INSERT INTO test (val) VALUES (?)').run('hello');
const row = db.prepare('SELECT val FROM test').get();
console.log('Result:', row.val);
if (row.val === 'hello') {
    console.log('SQLCipher verification: SUCCESS');
} else {
    console.log('SQLCipher verification: FAILED');
    process.exit(1);
}
db.close();
