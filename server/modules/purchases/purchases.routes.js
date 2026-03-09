/**
 * Purchases Routes — Hisaab Pro
 */

'use strict';

const express = require('express');
const router = express.Router();
const purchasesService = require('./purchases.service');

// List purchases
router.get('/', (req, res) => {
    try {
        const isDecoy = req.session.user && req.session.user.is_decoy;
        const result = purchasesService.listPurchases(req.query, isDecoy);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get single purchase
router.get('/:id', (req, res) => {
    try {
        const isDecoy = req.session.user && req.session.user.is_decoy;
        const result = purchasesService.getPurchaseById(req.params.id, isDecoy);
        if (!result) return res.status(404).json({ message: 'Purchase not found' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create purchase
router.post('/', (req, res) => {
    try {
        const isDecoy = req.session.user && req.session.user.is_decoy;
        const result = purchasesService.createPurchase(req.body, isDecoy);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete purchase
router.delete('/:id', (req, res) => {
    try {
        const isDecoy = req.session.user && req.session.user.is_decoy;
        purchasesService.deletePurchase(req.params.id, isDecoy);
        res.json({ message: 'Purchase deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
