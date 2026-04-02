/**
 * Reports Routes — Hisaab Pro
 * 
 * GET /api/v1/reports/daily-sales    — Daily sales report
 * GET /api/v1/reports/monthly        — Monthly financial report
 * GET /api/v1/reports/debtor-aging   — Debtor aging report
 * GET /api/v1/reports/creditor-schedule — Creditor payment schedule
 * GET /api/v1/reports/balance-sheet  — Balance sheet
 */

'use strict';

var express = require('express');
var router = express.Router();
var reportsService = require('./reports.service');
var { requireAuth } = require('../auth/auth.middleware');

router.use(requireAuth);

/**
 * GET /daily-sales
 */
router.get('/daily-sales', function(req, res) {
    try {
        var date = req.query.date || new Date().toISOString().split('T')[0];
        var report = reportsService.getDailySalesReport(date, req.session.user.is_decoy);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /monthly
 */
router.get('/monthly', function(req, res) {
    try {
        var now = new Date();
        var defaultMonth = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
        var month = req.query.month || defaultMonth;
        var report = reportsService.getMonthlyReport(month, req.session.user.is_decoy);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /debtor-aging
 */
router.get('/debtor-aging', function(req, res) {
    try {
        var date = req.query.date;
        var report = reportsService.getDebtorAgingReport(date, req.session.user.is_decoy);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /creditor-schedule
 */
router.get('/creditor-schedule', function(req, res) {
    try {
        var date = req.query.date;
        var report = reportsService.getCreditorSchedule(date, req.session.user.is_decoy);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /balance-sheet
 */
router.get('/balance-sheet', function(req, res) {
    try {
        var date = req.query.date;
        var report = reportsService.getBalanceSheet(date, req.session.user.is_decoy);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/account-ledger', function(req, res) {
    try {
        const { account_id, date_from, date_to } = req.query;
        if (!account_id) throw new Error('Account ID is required');
        const data = reportsService.getAccountLedger(account_id, date_from, date_to, req.session.user.is_decoy);
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * GET /amount-receivable
 */
router.get('/amount-receivable', function(req, res) {
    try {
        var date = req.query.date;
        var report = reportsService.getAmountReceivableReport(date, req.session.user.is_decoy);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
