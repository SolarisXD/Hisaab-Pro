/**
 * Purchases Routes — Hisaab Pro
 */

'use strict';

const express = require('express');
const router = express.Router();
const purchasesService = require('./purchases.service');
const { isDateInActiveFY } = require('../../shared/utils');
const { validate, purchaseSchema } = require('../../shared/validation');
const { requireAuth } = require('../auth/auth.middleware');

// All purchase routes require authentication
router.use(requireAuth);

// List purchases
router.get('/', (req, res) => {
    try {
        const isDecoy = req.session.user && req.session.user.is_decoy;
        const result = purchasesService.listPurchases(req.query, isDecoy);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to list purchases' });
    }
});

// Get single purchase
router.get('/:id', (req, res) => {
    try {
        const isDecoy = req.session.user && req.session.user.is_decoy;
        const result = purchasesService.getPurchaseById(req.params.id, isDecoy);
        if (!result) return res.status(404).json({ error: 'Purchase not found' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve purchase' });
    }
});

// Create purchase
router.post('/', validate(purchaseSchema), (req, res) => {
    try {
        const reqFy = req.headers['x-financial-year'];
        if (!isDateInActiveFY(req.body.date, reqFy)) {
            return res.status(400).json({ error: 'Transaction date cannot be outside the active financial year' });
        }
        const isDecoy = req.session.user && req.session.user.is_decoy;
        const result = purchasesService.createPurchase(req.body, isDecoy);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create purchase' });
    }
});

// Delete purchase
router.delete('/:id', (req, res) => {
    try {
        const isDecoy = req.session.user && req.session.user.is_decoy;
        purchasesService.deletePurchase(req.params.id, isDecoy);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete purchase' });
    }
});

module.exports = router;
