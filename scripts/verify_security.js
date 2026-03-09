/**
 * Security Verification Script — Hisaab Pro
 * 
 * Verifies Dual-Pool isolation and Auto-Wipe functionality.
 */

'use strict';

const { db } = require('../server/db/database');
const authService = require('../server/modules/auth/auth.service');
const salesService = require('../server/modules/sales/sales.service');
const accountsService = require('../server/modules/accounts/accounts.service');

async function runTests() {
    console.log('--- STARTING SECURITY VERIFICATION ---\n');

    try {
        // 1. Setup Test Data
        console.log('[1] Setting up test data...');
        const ts = Date.now();
        const realAcc = accountsService.createAccount({ name: 'Real Customer ' + ts, type: 'customer' }, false);
        const decoyAcc = accountsService.createAccount({ name: 'Decoy Customer ' + ts, type: 'customer' }, true);

        const realSale = salesService.createSale({ 
            invoice_no: 'TEST-REAL-' + ts,
            customer_account_id: realAcc.id, 
            date: '2026-03-07', 
            items: [{ item_name: 'Real Item', qty: 1, rate: 1000 }] 
        }, false);

        const decoySale = salesService.createSale({ 
            invoice_no: 'TEST-DECOY-' + ts,
            customer_account_id: decoyAcc.id, 
            date: '2026-03-07', 
            items: [{ item_name: 'Decoy Item', qty: 1, rate: 10 }] 
        }, true);

        // 2. Test Isolation (Listings)
        console.log('[2] Testing Data Isolation...');
        const realList = salesService.listSales({}, false);
        const decoyList = salesService.listSales({}, true);

        const realHasDecoy = realList.some(s => s.invoice_no === decoySale.invoice_no);
        const decoyHasReal = decoyList.some(s => s.invoice_no === realSale.invoice_no);

        if (realHasDecoy || decoyHasReal) {
            throw new Error('DATA LEAK DETECTED! Isolation failed.');
        }
        console.log('  → Isolation Logic: OK');

        // 3. Test Auto-Wipe Trigger
        console.log('[3] Testing Auto-Wipe Trigger...');
        const initialRealCount = db.prepare('SELECT COUNT(*) as count FROM sales WHERE is_decoy = 0').get().count;
        console.log(`  → Initial Real Sales: ${initialRealCount}`);

        console.log('  → Simulating 5 failed logins...');
        for (let i = 0; i < 5; i++) {
            try { authService.login('admin', 'wrong_pass', '127.0.0.1'); } catch (e) {}
        }

        const state = authService.getSecurityState();
        if (!state.is_nuked) {
            throw new Error('AUTO-WIPE FAILED TO TRIGGER after 5 attempts!');
        }

        const afterWipeCount = db.prepare('SELECT COUNT(*) as count FROM sales WHERE is_decoy = 0').get().count;
        const decoyCount = db.prepare('SELECT COUNT(*) as count FROM sales WHERE is_decoy = 1').get().count;

        console.log(`  → Real Sales after wipe: ${afterWipeCount}`);
        console.log(`  → Decoy Sales after wipe: ${decoyCount}`);

        if (afterWipeCount !== 0) {
            throw new Error('WIPE FAILED! Real data still exists.');
        }
        if (decoyCount === 0) {
            throw new Error('OVER-WIPE! Decoy data was accidentally deleted.');
        }

        console.log('  → Auto-Wipe Mechanism: OK');

        console.log('\n--- ALL SECURITY TESTS PASSED! ---');
        
        // Cleanup singleton state for future runs (not data, just the nuke flag to allow login)
        db.prepare('UPDATE security_state SET is_nuked = 0, failed_logins = 0 WHERE id = 1').run();

    } catch (err) {
        console.error('\n!!! SECURITY VERIFICATION FAILED !!!');
        console.error(err.message);
        process.exit(1);
    }
}

runTests();
