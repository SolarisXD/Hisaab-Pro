/**
 * Accounts Routes — Hisaab Pro
 * 
 * GET    /api/v1/accounts                  — List accounts
 * GET    /api/v1/accounts/summary          — Summary by type
 * GET    /api/v1/accounts/:id              — Get single account
 * POST   /api/v1/accounts                  — Create account
 * PUT    /api/v1/accounts/:id              — Update account
 * DELETE /api/v1/accounts/:id              — Deactivate account
 * GET    /api/v1/accounts/:id/transactions — Transaction history
 */

'use strict';

var express = require('express');
var router = express.Router();
var accountsService = require('./accounts.service');
var { requireAuth } = require('../auth/auth.middleware');
var { logActivity } = require('../auth/auth.service');

var accountTypesService = require('./account-types.service');

router.use(requireAuth);

/**
 * GET /types — List all account types
 */
router.get('/types', function(req, res) {
    try {
        var types = accountTypesService.listAccountTypes(req.query.include_inactive === 'true');
        res.json(types);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /types — Create account type
 */
router.post('/types', function(req, res) {
    try {
        var type = accountTypesService.createAccountType(req.body);
        logActivity(req.session.user.id, 'create_account_type', 'account_type', type.id, null, req.ip);
        res.status(201).json(type);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * PUT /types/:id — Update account type
 */
router.put('/types/:id', function(req, res) {
    try {
        var type = accountTypesService.updateAccountType(parseInt(req.params.id), req.body);
        logActivity(req.session.user.id, 'edit_account_type', 'account_type', type.id, null, req.ip);
        res.json(type);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * DELETE /types/:id — Delete account type
 */
router.delete('/types/:id', function(req, res) {
    try {
        accountTypesService.deleteAccountType(parseInt(req.params.id));
        logActivity(req.session.user.id, 'delete_account_type', 'account_type', parseInt(req.params.id), null, req.ip);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * GET / — List accounts
 */
router.get('/', function(req, res) {
    try {
        var accounts = accountsService.listAccounts({
            type: req.query.type,
            search: req.query.search
        }, req.session.user.is_decoy);
        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /summary — Account summary by type
 */
router.get('/summary', function(req, res) {
    try {
        var summary = accountsService.getAccountsSummary(req.session.user.is_decoy);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /:id — Get single account
 */
router.get('/:id', function(req, res) {
    try {
        var account = accountsService.getAccountById(parseInt(req.params.id), req.session.user.is_decoy);
        if (!account) return res.status(404).json({ error: 'Account not found' });
        res.json(account);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST / — Create account
 */
router.post('/', function(req, res) {
    try {
        var account = accountsService.createAccount(req.body, req.session.user.is_decoy);
        logActivity(req.session.user.id, 'create_account', 'account', account.id, null, req.ip);
        res.status(201).json(account);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * PUT /:id — Update account
 */
router.put('/:id', function(req, res) {
    try {
        var account = accountsService.updateAccount(parseInt(req.params.id), req.body, req.session.user.is_decoy);
        logActivity(req.session.user.id, 'edit_account', 'account', account.id, null, req.ip);
        res.json(account);
    } catch (err) {
        if (err.message === 'Account not found') return res.status(404).json({ error: err.message });
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /:id — Deactivate
 */
router.delete('/:id', function(req, res) {
    try {
        accountsService.deleteAccount(parseInt(req.params.id), req.session.user.is_decoy);
        logActivity(req.session.user.id, 'delete_account', 'account', parseInt(req.params.id), null, req.ip);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /:id/transactions — Transaction history
 */
router.get('/:id/transactions', function(req, res) {
    try {
        var transactions = accountsService.getAccountTransactions(parseInt(req.params.id), {
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            offset: req.query.offset ? parseInt(req.query.offset) : 0
        }, req.session.user.is_decoy);
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
