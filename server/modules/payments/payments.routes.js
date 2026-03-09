/**
 * Payments Routes — Hisaab Pro
 * 
 * GET    /api/v1/payments         — List payments
 * GET    /api/v1/payments/:id     — Get single payment
 * POST   /api/v1/payments         — Create payment
 * PUT    /api/v1/payments/:id     — Update payment
 * DELETE /api/v1/payments/:id     — Soft delete
 * GET    /api/v1/payments/summary — Payment summary for date range
 */

'use strict';

var express = require('express');
var router = express.Router();
var paymentsService = require('./payments.service');
var { requireAuth } = require('../auth/auth.middleware');
var { logActivity } = require('../auth/auth.service');

router.use(requireAuth);

/**
 * GET / — List payments
 */
router.get('/', function(req, res) {
    try {
        var payments = paymentsService.listPayments({
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            account_id: req.query.account_id,
            type: req.query.type,
            mode: req.query.mode,
            search: req.query.search,
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            offset: req.query.offset ? parseInt(req.query.offset) : 0
        }, req.session.user.is_decoy);
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /summary
 */
router.get('/summary', function(req, res) {
    try {
        var today = new Date().toISOString().split('T')[0];
        var summary = paymentsService.getPaymentsSummary(
            req.query.date_from || today,
            req.query.date_to || today,
            req.session.user.is_decoy
        );
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /:id
 */
router.get('/:id', function(req, res) {
    try {
        var payment = paymentsService.getPaymentById(parseInt(req.params.id), req.session.user.is_decoy);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        res.json(payment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST / — Create payment
 */
router.post('/', function(req, res) {
    try {
        var payment = paymentsService.createPayment(req.body, req.session.user.is_decoy);
        logActivity(req.session.user.id, 'create_payment', 'payment', payment.id, null, req.ip);
        res.status(201).json(payment);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * PUT /:id
 */
router.put('/:id', function(req, res) {
    try {
        var payment = paymentsService.updatePayment(parseInt(req.params.id), req.body, req.session.user.is_decoy);
        logActivity(req.session.user.id, 'edit_payment', 'payment', payment.id, null, req.ip);
        res.json(payment);
    } catch (err) {
        if (err.message === 'Payment not found') return res.status(404).json({ error: err.message });
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /:id
 */
router.delete('/:id', function(req, res) {
    try {
        paymentsService.deletePayment(parseInt(req.params.id), req.session.user.is_decoy);
        logActivity(req.session.user.id, 'delete_payment', 'payment', parseInt(req.params.id), null, req.ip);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
