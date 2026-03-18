
const { switchDatabase } = require('./server/db/database');
const db = switchDatabase('hisaab.db');

function check() {
    const accounts = db.prepare('SELECT id, name, type, opening_balance, current_balance FROM accounts WHERE is_active = 1').all();
    console.log('Account Diagnostics:');
    console.log('--------------------');
    
    for (const acc of accounts) {
        const trans = db.prepare('SELECT SUM(CASE WHEN type = \'debit\' THEN amount ELSE -amount END) as sum FROM transactions WHERE account_id = ? AND is_deleted = 0').get(acc.id);
        const calculatedBalance = acc.opening_balance + (trans.sum || 0);
        
        if (Math.abs(calculatedBalance - acc.current_balance) > 0.01) {
            console.log(`Mismatch found in Account: ${acc.name} (ID: ${acc.id}, Type: ${acc.type})`);
            console.log(`  Opening Balance:  ${acc.opening_balance}`);
            console.log(`  Transactions Sum: ${trans.sum || 0}`);
            console.log(`  Expected Balance: ${calculatedBalance}`);
            console.log(`  Stored Balance:   ${acc.current_balance}`);
            console.log(`  Difference:       ${calculatedBalance - acc.current_balance}`);
            console.log('--------------------');
        }
    }
}

try {
    check();
} catch (e) {
    console.error(e);
}
