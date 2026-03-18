
const { switchDatabase } = require('./server/db/database');
const fs = require('fs');
const path = require('path');

function repair(dbName) {
    console.log(`\nStarting repair for: ${dbName}`);
    const db = switchDatabase(dbName);
    
    const accounts = db.prepare('SELECT id, name, type, opening_balance, current_balance FROM accounts WHERE is_active = 1').all();
    
    const updateStmt = db.prepare('UPDATE accounts SET current_balance = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?');
    
    let repairCount = 0;

    const transaction = db.transaction(() => {
        for (const acc of accounts) {
            const trans = db.prepare('SELECT SUM(CASE WHEN type = \'debit\' THEN amount ELSE -amount END) as sum FROM transactions WHERE account_id = ? AND is_deleted = 0').get(acc.id);
            const calculatedBalance = acc.opening_balance + (trans.sum || 0);
            
            if (Math.abs(calculatedBalance - acc.current_balance) > 0.01) {
                console.log(`  Repairing ${acc.name} (ID: ${acc.id}): Stored=${acc.current_balance}, Calculated=${calculatedBalance}`);
                updateStmt.run(calculatedBalance, acc.id);
                repairCount++;
            }
        }
    });

    transaction();
    console.log(`Finished repair for ${dbName}. Repaired ${repairCount} accounts.`);
}

async function run() {
    try {
        // 1. Repair legacy database
        repair('hisaab.db');

        // 2. Repair new financial year database(s)
        const configPath = path.resolve(__dirname, 'config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        if (config.financial_years && config.financial_years.length > 0) {
            for (const fy of config.financial_years) {
                if (fy.db_filename && fy.db_filename !== 'hisaab.db') {
                    repair(fy.db_filename);
                }
            }
        }
    } catch (e) {
        console.error('Repair failed:', e);
    }
}

run();
