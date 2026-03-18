/**
 * repair_ledger_payments.js
 * 
 * Identifies sales and purchases with amount_paid > 0 that are missing 
 * matching payment transactions in the ledger, and inserts them.
 */

'use strict';

const { db, switchDatabase } = require('./server/db/database');
const fs = require('fs');
const path = require('path');

async function repairYear(dbName) {
    console.log(`\n--- Repairing Ledger Payments for: ${dbName} ---`);
    
    // Switch to this DB
    const yearDb = switchDatabase(dbName);
    
    // 1. Repair Sales Payments
    const sales = yearDb.prepare(`
        SELECT s.*, a.name as customer_name 
        FROM sales s
        JOIN accounts a ON s.customer_account_id = a.id
        WHERE s.amount_paid > 0 AND s.is_deleted = 0
    `).all();

    console.log(`Found ${sales.length} paid/partial sales. Checking for missing ledger payments...`);
    
    let salesFixed = 0;
    for (const sale of sales) {
        // Check if a payment transaction already exists for this sale
        // Type 'credit' for customer payments
        const existing = yearDb.prepare(`
            SELECT id FROM transactions 
            WHERE account_id = ? AND linked_sale_id = ? AND type = 'credit' AND is_deleted = 0
        `).get(sale.customer_account_id, sale.id);

        if (!existing) {
            console.log(`  [SALE] Fixing INV: ${sale.invoice_no} (${sale.customer_name}) - Missing Credit of ₹${sale.amount_paid}`);
            yearDb.prepare(`
                INSERT INTO transactions (date, account_id, type, amount, description, linked_sale_id, is_decoy, is_deleted)
                VALUES (?, ?, 'credit', ?, ?, ?, ?, 0)
            `).run(
                sale.date,
                sale.customer_account_id,
                sale.amount_paid,
                `Payment received for ${sale.invoice_no}`,
                sale.id,
                sale.is_decoy
            );
            salesFixed++;
        }
    }

    // 2. Repair Purchase Payments
    const purchases = yearDb.prepare(`
        SELECT p.*, a.name as supplier_name 
        FROM purchases p
        JOIN accounts a ON p.supplier_account_id = a.id
        WHERE p.amount_paid > 0 AND p.is_deleted = 0
    `).all();

    console.log(`Found ${purchases.length} paid/partial purchases. Checking for missing ledger payments...`);
    
    let purchasesFixed = 0;
    for (const pur of purchases) {
        // Check if a payment transaction already exists for this purchase
        // Type 'debit' for supplier payments
        const existing = yearDb.prepare(`
            SELECT id FROM transactions 
            WHERE account_id = ? AND linked_purchase_id = ? AND type = 'debit' AND is_deleted = 0
        `).get(pur.supplier_account_id, pur.id);

        if (!existing) {
            console.log(`  [PURCHASE] Fixing INV: ${pur.invoice_no} (${pur.supplier_name}) - Missing Debit of ₹${pur.amount_paid}`);
            yearDb.prepare(`
                INSERT INTO transactions (date, account_id, type, amount, description, linked_purchase_id, is_decoy, is_deleted)
                VALUES (?, ?, 'debit', ?, ?, ?, ?, 0)
            `).run(
                pur.date,
                pur.supplier_account_id,
                pur.amount_paid,
                `Payment made for ${pur.invoice_no}`,
                pur.id,
                pur.is_decoy
            );
            purchasesFixed++;
        }
    }

    console.log(`Finished ${dbName}: Fixed ${salesFixed} sales, ${purchasesFixed} purchases.`);
}

async function run() {
    try {
        const config = require('./server/config');
        
        // Repair main DB file if it exists
        const mainDbFile = path.basename(config.database.path);
        await repairYear(mainDbFile);

        // Repair financial years in data folder
        const dataDir = path.resolve(__dirname, 'data');
        if (fs.existsSync(dataDir)) {
            const files = fs.readdirSync(dataDir);
            for (const file of files) {
                if (file.startsWith('hisaab_') && file.endsWith('.db') && file !== mainDbFile) {
                    await repairYear(file);
                }
            }
        }
        console.log('\n--- Global Ledger Repair Complete ---');
    } catch (err) {
        console.error('Repair failed:', err);
        process.exit(1);
    }
}

run();
