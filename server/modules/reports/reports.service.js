/**
 * Reports Service — Hisaab Pro
 * 
 * Aggregation queries for all report types.
 */

'use strict';

var { db } = require('../../db/database');
var config = require('../../config');

/**
 * Daily sales report
 */
function getDailySalesReport(date, isDecoy) {
    var sales = db.prepare(
        'SELECT s.*, a.name as customer_name FROM sales s' +
        ' LEFT JOIN accounts a ON s.customer_account_id = a.id' +
        ' WHERE s.date = ? AND s.is_deleted = 0 AND s.is_decoy = ?' +
        ' ORDER BY s.id'
    ).all(date, isDecoy ? 1 : 0);

    // Items removed as per request

    var summary = db.prepare(
        'SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total,' +
        ' COALESCE(SUM(amount_paid), 0) as paid' +
        ' FROM sales WHERE date = ? AND is_deleted = 0 AND is_decoy = ?'
    ).get(date, isDecoy ? 1 : 0);

    return {
        date: date,
        sales: sales,
        summary: summary,
        shop: config.shop
    };
}

/**
 * Monthly financial report
 */
function getMonthlyReport(yearMonth, isDecoy) {
    var startDate = yearMonth + '-01';
    // Get last day of month
    var parts = yearMonth.split('-');
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]);
    var lastDay = new Date(year, month, 0).getDate();
    var endDate = yearMonth + '-' + ('0' + lastDay).slice(-2);

    // Sales summary
    var salesSummary = db.prepare(
        'SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total,' +
        ' COALESCE(SUM(amount_paid), 0) as paid, COALESCE(SUM(total - amount_paid), 0) as outstanding' +
        ' FROM sales WHERE date >= ? AND date <= ? AND is_deleted = 0 AND is_decoy = ?'
    ).get(startDate, endDate, isDecoy ? 1 : 0);

    // Daily breakdown
    var dailyBreakdown = db.prepare(
        'SELECT date, COUNT(*) as count, COALESCE(SUM(total), 0) as total' +
        ' FROM sales WHERE date >= ? AND date <= ? AND is_deleted = 0 AND is_decoy = ?' +
        ' GROUP BY date ORDER BY date'
    ).all(startDate, endDate, isDecoy ? 1 : 0);

    // Payments summary
    var paymentsSummary = db.prepare(
        'SELECT type, mode, COUNT(*) as count, COALESCE(SUM(amount), 0) as total' +
        ' FROM payments WHERE date >= ? AND date <= ? AND is_deleted = 0 AND is_decoy = ?' +
        ' GROUP BY type, mode'
    ).all(startDate, endDate, isDecoy ? 1 : 0);

    // Top customers
    var topCustomers = db.prepare(
        'SELECT a.name, COUNT(s.id) as sale_count, COALESCE(SUM(s.total), 0) as total' +
        ' FROM sales s JOIN accounts a ON s.customer_account_id = a.id' +
        ' WHERE s.date >= ? AND s.date <= ? AND s.is_deleted = 0 AND s.is_decoy = ?' +
        ' GROUP BY s.customer_account_id ORDER BY total DESC LIMIT 10'
    ).all(startDate, endDate, isDecoy ? 1 : 0);

    return {
        month: yearMonth,
        period: { start: startDate, end: endDate },
        sales: salesSummary,
        daily_breakdown: dailyBreakdown,
        payments: paymentsSummary,
        top_customers: topCustomers,
        shop: config.shop
    };
}

/**
 * Debtor aging report
 * Buckets: 0-30 days, 30-60 days, 60+ days
 */
function getDebtorAgingReport(isDecoy) {
    var today = new Date().toISOString().split('T')[0];

    var debtors = db.prepare(
        'SELECT a.id, a.name, a.phone, a.current_balance,' +
        ' (SELECT MAX(s.date) FROM sales s WHERE s.customer_account_id = a.id AND s.is_deleted = 0 AND s.is_decoy = ?) as last_sale_date,' +
        ' (SELECT MAX(p.date) FROM payments p WHERE p.account_id = a.id AND p.type = \'in\' AND p.is_deleted = 0 AND p.is_decoy = ?) as last_payment_date' +
        ' FROM accounts a WHERE a.type = \'customer\' AND a.current_balance > 0 AND a.is_active = 1 AND a.is_decoy = ?' +
        ' ORDER BY a.current_balance DESC'
    ).all(isDecoy ? 1 : 0, isDecoy ? 1 : 0, isDecoy ? 1 : 0);

    var buckets = { '0-30': [], '30-60': [], '60+': [] };
    var totals = { '0-30': 0, '30-60': 0, '60+': 0 };

    for (var i = 0; i < debtors.length; i++) {
        var debtor = debtors[i];
        var lastDate = debtor.last_sale_date || debtor.last_payment_date;
        var daysOld = 0;

        if (lastDate) {
            var diff = new Date(today) - new Date(lastDate);
            daysOld = Math.floor(diff / (1000 * 60 * 60 * 24));
        }

        debtor.days_outstanding = daysOld;

        if (daysOld <= 30) {
            buckets['0-30'].push(debtor);
            totals['0-30'] += debtor.current_balance;
        } else if (daysOld <= 60) {
            buckets['30-60'].push(debtor);
            totals['30-60'] += debtor.current_balance;
        } else {
            buckets['60+'].push(debtor);
            totals['60+'] += debtor.current_balance;
        }
    }

    return {
        date: today,
        buckets: buckets,
        totals: totals,
        grand_total: totals['0-30'] + totals['30-60'] + totals['60+'],
        shop: config.shop
    };
}

/**
 * Creditor payment schedule
 */
function getCreditorSchedule(isDecoy) {
    var creditors = db.prepare(
        'SELECT a.id, a.name, a.phone, a.current_balance,' +
        ' (SELECT MAX(p.date) FROM payments p WHERE p.account_id = a.id AND p.type = \'out\' AND p.is_deleted = 0 AND p.is_decoy = ?) as last_payment_date' +
        ' FROM accounts a WHERE a.type = \'supplier\' AND a.current_balance > 0 AND a.is_active = 1 AND a.is_decoy = ?' +
        ' ORDER BY a.current_balance DESC'
    ).all(isDecoy ? 1 : 0, isDecoy ? 1 : 0);

    var total = 0;
    for (var i = 0; i < creditors.length; i++) {
        total += creditors[i].current_balance;
    }

    return {
        date: new Date().toISOString().split('T')[0],
        creditors: creditors,
        total: total,
        shop: config.shop
    };
}

/**
 * Balance sheet — all account balances
 */
function getBalanceSheet(isDecoy) {
    var accounts = db.prepare(
        'SELECT id, name, type, current_balance FROM accounts WHERE is_active = 1 AND is_decoy = ? ORDER BY type, name'
    ).all(isDecoy ? 1 : 0);

    var grouped = {};
    for (var i = 0; i < accounts.length; i++) {
        var type = accounts[i].type;
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(accounts[i]);
    }

    return {
        date: new Date().toISOString().split('T')[0],
        accounts: grouped,
        shop: config.shop
    };
}

/**
 * Account Ledger (Account Statement)
 */
function getAccountLedger(accountId, dateFrom, dateTo, isDecoy) {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND is_decoy = ?').get(accountId, isDecoy ? 1 : 0);
    if (!account) throw new Error('Account not found');

    let sql = `
        SELECT t.*, 
            s.invoice_no as linked_invoice,
            p.mode as payment_mode
        FROM transactions t
        LEFT JOIN sales s ON t.linked_sale_id = s.id
        LEFT JOIN payments p ON t.linked_payment_id = p.id
        WHERE t.account_id = ? AND t.is_decoy = ?
    `;
    const params = [accountId, isDecoy ? 1 : 0];

    if (dateFrom) {
        sql += ' AND t.date >= ?';
        params.push(dateFrom);
    }
    if (dateTo) {
        sql += ' AND t.date <= ?';
        params.push(dateTo);
    }

    sql += ' ORDER BY t.date ASC, t.id ASC';

    const transactions = db.prepare(sql).all(...params);

    // Calculate running balance
    let balance = account.opening_balance;
    // Note: This is an approximation if start date is filtered. 
    // For a true ledger, we'd sum all transactions before dateFrom.
    if (dateFrom) {
        const prevSum = db.prepare(`
            SELECT SUM(CASE WHEN type = 'debit' THEN amount ELSE -amount END) as sum
            FROM transactions WHERE account_id = ? AND is_decoy = ? AND date < ?
        `).get(accountId, isDecoy ? 1 : 0, dateFrom);
        balance += (prevSum.sum || 0);
    }

    const ledgerEntries = transactions.map(t => {
        if (t.type === 'debit') balance += t.amount;
        else balance -= t.amount;
        return { ...t, running_balance: balance };
    });

    return {
        account: account,
        period: { from: dateFrom, to: dateTo },
        opening_balance: balance - (ledgerEntries.reduce((sum, e) => sum + (e.type === 'debit' ? e.amount : -e.amount), 0)),
        transactions: ledgerEntries,
        closing_balance: balance,
        shop: config.shop
    };
}

module.exports = {
    getDailySalesReport: getDailySalesReport,
    getMonthlyReport: getMonthlyReport,
    getDebtorAgingReport: getDebtorAgingReport,
    getCreditorSchedule: getCreditorSchedule,
    getBalanceSheet: getBalanceSheet,
    getAccountLedger: getAccountLedger
};
