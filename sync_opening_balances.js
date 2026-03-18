
const { switchDatabase } = require('./server/db/database');
const fs = require('fs');
const path = require('path');

function syncOpeningBalances() {
    const configPath = path.resolve(__dirname, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    if (!config.financial_years || config.financial_years.length === 0) {
        console.log('No financial years found to sync.');
        return;
    }

    // Usually legacy 'hisaab.db' is the source for the first added year.
    // If there were multiple years, we'd need to chain them, but let's target the active FY from legacy first.
    console.log('Using hisaab.db as source of truth for opening balances.');
    const sourceDb = switchDatabase('hisaab.db');
    const sourceAccounts = sourceDb.prepare('SELECT name, current_balance FROM accounts WHERE is_active = 1').all();
    const sourceMap = new Map(sourceAccounts.map(a => [a.name, a.current_balance]));

    for (const fy of config.financial_years) {
        console.log(`\nSyncing Opening Balances for: ${fy.name} (${fy.db_filename})`);
        const targetDb = switchDatabase(fy.db_filename);
        const targetAccounts = targetDb.prepare('SELECT id, name, opening_balance FROM accounts WHERE is_active = 1').all();
        
        let updateCount = 0;
        const transaction = targetDb.transaction(() => {
            const updateStmt = targetDb.prepare('UPDATE accounts SET opening_balance = ? WHERE id = ?');
            for (const acc of targetAccounts) {
                const sourceBalance = sourceMap.get(acc.name);
                if (sourceBalance !== undefined && Math.abs(sourceBalance - acc.opening_balance) > 0.01) {
                    console.log(`  Syncing ${acc.name}: Old Opening=${acc.opening_balance}, New Opening=${sourceBalance}`);
                    updateStmt.run(sourceBalance, acc.id);
                    updateCount++;
                }
            }
        });

        transaction();
        console.log(`  Finished sync for ${fy.name}. Updated ${updateCount} accounts.`);
    }
}

try {
    syncOpeningBalances();
} catch (e) {
    console.error(e);
}
