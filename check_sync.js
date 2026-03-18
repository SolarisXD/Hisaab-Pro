
const { switchDatabase } = require('./server/db/database');
const fs = require('fs');
const path = require('path');

function checkSync() {
    const configPath = path.resolve(__dirname, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    if (!config.financial_years || config.financial_years.length === 0) {
        console.log('No financial years found in config.');
        return;
    }

    const legacyDb = switchDatabase('hisaab.db');
    const legacyAccounts = legacyDb.prepare('SELECT id, name, current_balance FROM accounts WHERE is_active = 1').all();
    const legacyMap = new Map(legacyAccounts.map(a => [a.name, a.current_balance]));

    for (const fy of config.financial_years) {
        console.log(`\nChecking sync for: ${fy.name} (${fy.db_filename})`);
        const fyDb = switchDatabase(fy.db_filename);
        const fyAccounts = fyDb.prepare('SELECT id, name, opening_balance FROM accounts WHERE is_active = 1').all();
        
        let mismatchCount = 0;
        for (const acc of fyAccounts) {
            const legacyBalance = legacyMap.get(acc.name);
            if (legacyBalance !== undefined && Math.abs(legacyBalance - acc.opening_balance) > 0.01) {
                console.log(`  Mismatch: ${acc.name} - Legacy Closing: ${legacyBalance}, FY Opening: ${acc.opening_balance}`);
                mismatchCount++;
            }
        }
        console.log(`  Total Mismatches for ${fy.name}: ${mismatchCount}`);
    }
}

try {
    checkSync();
} catch (e) {
    console.error(e);
}
