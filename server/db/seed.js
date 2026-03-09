/**
 * Seed Script — Hisaab Pro
 * 
 * Seeds the database with demo data for testing.
 * Creates both Real (Admin) and Decoy data pools.
 * Run: `npm run seed` or `node server/db/seed.js`
 */

'use strict';

var { db } = require('./database');
var bcrypt = require('bcryptjs');

var SALT_ROUNDS = 10;

console.log('[Seed] Starting database seed with Dual-Pool support...\n');

// Check if already seeded
var existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (existingUsers.count > 0) {
    console.log('[Seed] Database already has data. Skipping seed.');
    process.exit(0);
}

/**
 * Helper to seed a pool (Real or Decoy)
 */
function seedPool(isDecoy) {
    var suffix = isDecoy ? ' (Decoy)' : '';
    console.log(`[Seed] Seeding ${isDecoy ? 'DECOY' : 'REAL'} pool...`);

    // 1. Create Accounts
    var accounts = isDecoy ? [
        { name: 'Walk-in Customer', type: 'customer', phone: '0000000000', address: 'Local', opening_balance: 0 },
        { name: 'Local Hardware Store', type: 'supplier', phone: '1111111111', address: 'Nearby', opening_balance: 1000 },
        { name: 'Cash Register', type: 'cash', phone: null, address: null, opening_balance: 5000 }
    ] : [
        { name: 'Ramesh Kumar', type: 'customer', phone: '9876543210', address: 'Sādri Main Market', opening_balance: 15000 },
        { name: 'Cera Sanitaryware', type: 'supplier', phone: '9111222333', address: 'Ahmedabad, Gujarat', opening_balance: 50000 },
        { name: 'Cash in Hand', type: 'cash', phone: null, address: null, opening_balance: 25000 },
        { name: 'SBI Business Account', type: 'bank', phone: null, address: 'SBI Sādri Branch', opening_balance: 150000 }
    ];

    var insertAccount = db.prepare(
        'INSERT INTO accounts (name, type, phone, address, opening_balance, current_balance, is_decoy) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    var accountIds = {};
    for (var a of accounts) {
        var res = insertAccount.run(a.name, a.type, a.phone, a.address, a.opening_balance, a.opening_balance, isDecoy ? 1 : 0);
        accountIds[a.name] = res.lastInsertRowid;
    }

    // 2. Create Sales
    var sampleSales = isDecoy ? [
        { invoice_no: 'D-001', date: '2026-03-01', customer: 'Walk-in Customer', items: [{ name: 'Nails 1kg', qty: 2, rate: 150 }] }
    ] : [
        { invoice_no: 'INV-001', date: '2026-03-01', customer: 'Ramesh Kumar', items: [{ name: 'Cera Wash Basin', qty: 2, rate: 3500 }] }
    ];

    var insertSale = db.prepare(
        'INSERT INTO sales (invoice_no, date, customer_account_id, subtotal, tax_percent, tax_amount, discount, total, amount_paid, status, is_decoy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    var insertItem = db.prepare(
        'INSERT INTO sales_items (sale_id, item_name, qty, rate, amount) VALUES (?, ?, ?, ?, ?)'
    );
    var insertTransaction = db.prepare(
        'INSERT INTO transactions (date, account_id, type, amount, description, linked_sale_id, is_decoy) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    for (var s of sampleSales) {
        var custId = accountIds[s.customer];
        var subtotal = s.items.reduce((sum, i) => sum + (i.qty * i.rate), 0);
        var tax = Math.round(subtotal * 0.18);
        var total = subtotal + tax;

        var saleRes = insertSale.run(s.invoice_no, s.date, custId, subtotal, 18, tax, 0, total, total, 'paid', isDecoy ? 1 : 0);
        var saleId = saleRes.lastInsertRowid;

        for (var item of s.items) {
            insertItem.run(saleId, item.name, item.qty, item.rate, item.qty * item.rate);
        }

        insertTransaction.run(s.date, custId, 'debit', total, 'Sale ' + s.invoice_no, saleId, isDecoy ? 1 : 0);
        console.log(`  → Created ${isDecoy ? 'Decoy' : 'Real'} Sale: ${s.invoice_no}`);
    }

    // 3. Create Payments
    var samplePayments = isDecoy ? [
        { date: '2026-03-02', account: 'Local Hardware Store', amount: 500, type: 'out', mode: 'cash', notes: 'Utility' }
    ] : [
        { date: '2026-03-02', account: 'Ramesh Kumar', amount: 2000, type: 'in', mode: 'upi', notes: 'Partial' }
    ];

    var insertPayment = db.prepare(
        'INSERT INTO payments (date, account_id, amount, type, mode, notes, is_decoy) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    var insertPayTrans = db.prepare(
        'INSERT INTO transactions (date, account_id, type, amount, description, linked_payment_id, is_decoy) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    for (var p of samplePayments) {
        var accId = accountIds[p.account];
        var payRes = insertPayment.run(p.date, accId, p.amount, p.type, p.mode, p.notes, isDecoy ? 1 : 0);
        var payId = payRes.lastInsertRowid;

        insertPayTrans.run(p.date, accId, p.type === 'in' ? 'credit' : 'debit', p.amount, 'Payment ' + p.type, payId, isDecoy ? 1 : 0);
        
        // Update balance
        db.prepare('UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?')
            .run(p.type === 'in' ? -p.amount : -p.amount, accId);
            
        console.log(`  → Created ${isDecoy ? 'Decoy' : 'Real'} Payment: ₹${p.amount}`);
    }
}

// 1. Create Users
console.log('[Seed] Creating users...');
var adminHash = bcrypt.hashSync('admin123', SALT_ROUNDS);
var decoyHash = bcrypt.hashSync('decoy123', SALT_ROUNDS);

db.prepare('INSERT INTO users (username, password_hash, role, is_decoy) VALUES (?, ?, ?, ?)').run('admin', adminHash, 'owner', 0);
db.prepare('INSERT INTO users (username, password_hash, role, is_decoy) VALUES (?, ?, ?, ?)').run('decoy', decoyHash, 'owner', 1);

console.log('  → User: admin / admin123 (REAL)');
console.log('  → User: decoy / decoy123 (DECOY)');

// 2. Seed Pools
seedPool(false); // Real
seedPool(true);  // Decoy

console.log('\n[Seed] ✅ Dual-pool database seeded successfully!');
