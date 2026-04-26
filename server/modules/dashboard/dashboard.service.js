/**
 * Dashboard Service — Hisaab Pro
 * 
 * Aggregates business data for the dashboard overview.
 */

'use strict';

var { db } = require('../../db/database');
var accountsService = require('../accounts/accounts.service');

/**
 * Get complete dashboard data
 */
function getDashboardData(isDecoy) {
    var now = new Date();
    var offset = now.getTimezoneOffset() * 60000;
    var localISOTime = (new Date(now.getTime() - offset)).toISOString().split('T')[0];
    var today = localISOTime;

    // Get first day of current month
    var monthStart = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-01';

    // Today's sales
    var todaySales = db.prepare(
        'SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total' +
        ' FROM sales WHERE date = ? AND is_deleted = 0 AND is_decoy = ?'
    ).get(today, isDecoy ? 1 : 0);

    // This month's sales
    var monthSales = db.prepare(
        'SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total' +
        ' FROM sales WHERE date >= ? AND date <= ? AND is_deleted = 0 AND is_decoy = ?'
    ).get(monthStart, today, isDecoy ? 1 : 0);

    // Total outstanding (debtors)
    var totalDebtors = accountsService.getTotalDebtors(isDecoy);

    // Total payable (creditors)
    var totalCreditors = accountsService.getTotalCreditors(isDecoy);

    // Cash and bank balances
    var cashBankBalances = accountsService.getCashBankBalances(isDecoy);
    var cashBalance = 0;
    var bankBalance = 0;
    for (var i = 0; i < cashBankBalances.length; i++) {
        if (cashBankBalances[i].type === 'cash') cashBalance += cashBankBalances[i].current_balance;
        if (cashBankBalances[i].type === 'bank') bankBalance += cashBankBalances[i].current_balance;
    }

    // Last 10 transactions
    var recentTransactions = db.prepare(
        'SELECT t.*, a.name as account_name FROM transactions t' +
        ' LEFT JOIN accounts a ON t.account_id = a.id' +
        ' WHERE t.is_deleted = 0 AND t.is_decoy = ?' +
        ' ORDER BY t.id DESC LIMIT 10'
    ).all(isDecoy ? 1 : 0);

    // Daily sales trend (last 7 days)
    var dailyTrend = db.prepare(
        'SELECT date, COUNT(*) as count, COALESCE(SUM(total), 0) as total' +
        ' FROM sales WHERE date >= date(?, \'-6 days\') AND is_deleted = 0 AND is_decoy = ?' +
        ' GROUP BY date ORDER BY date'
    ).all(today, isDecoy ? 1 : 0);

    // Monthly comparison (last 6 months)
    var monthlyComparison = db.prepare(
        'SELECT strftime(\'%Y-%m\', date) as month,' +
        ' COUNT(*) as count, COALESCE(SUM(total), 0) as total' +
        ' FROM sales WHERE date >= date(?, \'-5 months\', \'start of month\') AND is_deleted = 0 AND is_decoy = ?' +
        ' GROUP BY strftime(\'%Y-%m\', date) ORDER BY month'
    ).all(today, isDecoy ? 1 : 0);

    // Payment mode breakdown (this month)
    var paymentModes = db.prepare(
        'SELECT mode, COUNT(*) as count, COALESCE(SUM(amount), 0) as total' +
        ' FROM payments WHERE date >= ? AND date <= ? AND is_deleted = 0 AND type = \'in\' AND is_decoy = ?' +
        ' GROUP BY mode'
    ).all(monthStart, today, isDecoy ? 1 : 0);

    return {
        today_sales: todaySales,
        month_sales: monthSales,
        total_debtors: totalDebtors,
        total_creditors: totalCreditors,
        cash_balance: cashBalance,
        bank_balance: bankBalance,
        cash_bank_accounts: cashBankBalances,
        recent_transactions: recentTransactions,
        charts: {
            daily_trend: dailyTrend,
            monthly_comparison: monthlyComparison,
            payment_modes: paymentModes
        }
    };
}

module.exports = {
    getDashboardData: getDashboardData
};
