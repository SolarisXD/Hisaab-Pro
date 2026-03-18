/**
 * repair_global_ledgers.js
 * 
 * A comprehensive repair script to:
 * 1. Ensure every payment (direct or via sale/purchase) has a matching Asset (Cash/Bank) transaction.
 * 2. Recalculate 'current_balance' for every account across all financial years.
 */

'use strict';

const { switchDatabase } = require('./server/db/database');
const fs = require('fs');
const path = require('path');
const config = require('./server/config');

async function repairYear(dbName) {
    try {
        console.log(`\n--- [START] Repairing: ${dbName} ---`);
        const db = switchDatabase(dbName);

        // Helper: Find default accounts
        const getDefaultCash = () => db.prepare("SELECT * FROM accounts WHERE type = 'cash' AND is_active = 1 ORDER BY id ASC LIMIT 1").get();
        const getDefaultBank = () => db.prepare("SELECT * FROM accounts WHERE type = 'bank' AND is_active = 1 ORDER BY id ASC LIMIT 1").get();

        const cashAcc = getDefaultCash();
        const bankAcc = getDefaultBank();

        if (!cashAcc) {
            console.warn(`[WARNING] No active Cash account found in ${dbName}.`);
        } else {
            console.log(`[INFO] Using Cash Account: ${cashAcc.name} (ID: ${cashAcc.id})`);
        }

        // 1. Repair Payments table entries
        const payments = db.prepare("SELECT p.*, a.name as party_name FROM payments p JOIN accounts a ON p.account_id = a.id WHERE p.is_deleted = 0").all();
        console.log(`[1/4] Checking ${payments.length} payment records...`);
        
        let paymentsFixed = 0;
        for (const p of payments) {
            // Check for Leg 1: Party (Credit if 'in', Debit if 'out')
            const partyType = p.type === 'in' ? 'credit' : 'debit';
            const leg1 = db.prepare("SELECT id FROM transactions WHERE account_id = ? AND linked_payment_id = ? AND type = ? AND is_deleted = 0").get(p.account_id, p.id, partyType);
            
            if (!leg1) {
                console.log(`  [FIX] Leg 1 (Party) for Payment ID ${p.id} (${p.party_name})`);
                db.prepare("INSERT INTO transactions (date, account_id, type, amount, description, linked_payment_id, is_decoy, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, 0)")
                    .run(p.date, p.account_id, partyType, p.amount, `Payment ${p.type === 'in' ? 'received' : 'made'} (${p.mode})`, p.id, p.is_decoy);
                paymentsFixed++;
            }

            // Check for Leg 2: Asset (Debit if 'in', Credit if 'out')
            const assetAcc = (p.mode === 'cash' || !p.mode) ? cashAcc : bankAcc;
            if (assetAcc) {
                const assetType = p.type === 'in' ? 'debit' : 'credit';
                const leg2 = db.prepare("SELECT id FROM transactions WHERE account_id = ? AND linked_payment_id = ? AND type = ? AND is_deleted = 0").get(assetAcc.id, p.id, assetType);
                
                if (!leg2) {
                    console.log(`  [FIX] Leg 2 (Asset) for Payment ID ${p.id} via ${assetAcc.name}`);
                    db.prepare("INSERT INTO transactions (date, account_id, type, amount, description, linked_payment_id, is_decoy, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, 0)")
                        .run(p.date, assetAcc.id, assetType, p.amount, `Payment ${p.type === 'in' ? 'received' : 'made'} from ${p.party_name}`, p.id, p.is_decoy);
                    paymentsFixed++;
                }
            }
        }

        // 2. Repair Sales (Immediate Payments)
        const sales = db.prepare("SELECT s.*, a.name as party_name FROM sales s JOIN accounts a ON s.customer_account_id = a.id WHERE s.amount_paid > 0 AND s.is_deleted = 0").all();
        console.log(`[2/4] Checking ${sales.length} paid sales...`);
        let salesFixed = 0;
        for (const s of sales) {
            // Leg 1: Party (Credit)
            const leg1 = db.prepare("SELECT id FROM transactions WHERE account_id = ? AND linked_sale_id = ? AND type = 'credit' AND is_deleted = 0").get(s.customer_account_id, s.id);
            if (!leg1) {
                 console.log(`  [FIX] Leg 1 (Party) for INV ${s.invoice_no}`);
                 db.prepare("INSERT INTO transactions (date, account_id, type, amount, description, linked_sale_id, is_decoy, is_deleted) VALUES (?, ?, 'credit', ?, ?, ?, ?, 0)")
                    .run(s.date, s.customer_account_id, s.amount_paid, `Payment received for ${s.invoice_no}`, s.id, s.is_decoy);
                 salesFixed++;
            }

            // Leg 2: Asset (Debit) - Assume Cash for immediate sales
            if (cashAcc) {
                const leg2 = db.prepare("SELECT id FROM transactions WHERE account_id = ? AND linked_sale_id = ? AND type = 'debit' AND description LIKE 'Payment received%' AND is_deleted = 0").get(cashAcc.id, s.id);
                if (!leg2) {
                    console.log(`  [FIX] Leg 2 (Asset) for INV ${s.invoice_no} via ${cashAcc.name}`);
                    db.prepare("INSERT INTO transactions (date, account_id, type, amount, description, linked_sale_id, is_decoy, is_deleted) VALUES (?, ?, 'debit', ?, ?, ?, ?, 0)")
                        .run(s.date, cashAcc.id, s.amount_paid, `Payment received for ${s.invoice_no} from ${s.party_name}`, s.id, s.is_decoy);
                    salesFixed++;
                }
            }
        }

        // 3. Repair Purchases (Immediate Payments)
        const purchases = db.prepare("SELECT p.*, a.name as party_name FROM purchases p JOIN accounts a ON p.supplier_account_id = a.id WHERE p.amount_paid > 0 AND p.is_deleted = 0").all();
        console.log(`[3/4] Checking ${purchases.length} paid purchases...`);
        let purchasesFixed = 0;
        for (const p of purchases) {
            // Leg 1: Party (Debit)
            const leg1 = db.prepare("SELECT id FROM transactions WHERE account_id = ? AND linked_purchase_id = ? AND type = 'debit' AND is_deleted = 0").get(p.supplier_account_id, p.id);
            if (!leg1) {
                 console.log(`  [FIX] Leg 1 (Party) for Purchase ${p.invoice_no}`);
                 db.prepare("INSERT INTO transactions (date, account_id, type, amount, description, linked_purchase_id, is_decoy, is_deleted) VALUES (?, ?, 'debit', ?, ?, ?, ?, 0)")
                    .run(p.date, p.supplier_account_id, p.amount_paid, `Payment made for ${p.invoice_no}`, p.id, p.is_decoy);
                 purchasesFixed++;
            }

            // Leg 2: Asset (Credit) - Assume Cash
            if (cashAcc) {
                const leg2 = db.prepare("SELECT id FROM transactions WHERE account_id = ? AND linked_purchase_id = ? AND type = 'credit' AND description LIKE 'Payment made%' AND is_deleted = 0").get(cashAcc.id, p.id);
                if (!leg2) {
                    console.log(`  [FIX] Leg 2 (Asset) for Purchase ${p.invoice_no} via ${cashAcc.name}`);
                    db.prepare("INSERT INTO transactions (date, account_id, type, amount, description, linked_purchase_id, is_decoy, is_deleted) VALUES (?, ?, 'credit', ?, ?, ?, ?, 0)")
                        .run(p.date, cashAcc.id, p.amount_paid, `Payment made for ${p.invoice_no} to ${p.party_name}`, p.id, p.is_decoy);
                    purchasesFixed++;
                }
            }
        }

        // 4. Recalculate all balances
        console.log(`[4/4] Recalculating account balances...`);
        const accounts = db.prepare("SELECT id, name, type, opening_balance FROM accounts WHERE is_active = 1").all();
        let balancesUpdated = 0;
        for (const acc of accounts) {
            // Sum debits and credits
            const trans = db.prepare("SELECT SUM(CASE WHEN type = 'debit' THEN amount ELSE -amount END) as sum FROM transactions WHERE account_id = ? AND is_deleted = 0").get(acc.id);
            const newBalance = acc.opening_balance + (trans.sum || 0);
            
            db.prepare("UPDATE accounts SET current_balance = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(newBalance, acc.id);
            balancesUpdated++;
        }

        console.log(`--- [DONE] ${dbName}: Fixed ${paymentsFixed + salesFixed + purchasesFixed} transactions, updated ${balancesUpdated} balances. ---`);
    } catch (err) {
        console.error(`--- [ERROR] Failed to repair ${dbName}:`, err.message);
    }
}

async function run() {
    try {
        console.log("Global Repair Utility v2.0 Starting...");
        
        // 1. Repair default database
        const mainDbFile = path.basename(config.database.path); // Usually hisaab.db
        await repairYear(mainDbFile);

        // 2. Repair all financial years
        if (config.financial_years && config.financial_years.length > 0) {
            console.log(`Found ${config.financial_years.length} financial years to process.`);
            for (const fy of config.financial_years) {
                if (fy.db_filename && fy.db_filename !== mainDbFile) {
                    await repairYear(fy.db_filename);
                }
            }
        } else {
            console.log("No additional financial years found in config.");
        }
        console.log('\n--- GLOBAL REPAIR PROCESS COMPLETE ---');
        process.exit(0);
    } catch (err) {
        console.error('Fatal Error during repair:', err);
        process.exit(1);
    }
}

run();
