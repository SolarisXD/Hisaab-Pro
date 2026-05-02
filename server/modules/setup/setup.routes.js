/**
 * Setup Routes — Hisaab Pro
 * 
 * API endpoints for first-run setup wizard.
 * These endpoints are NOT protected by authentication since setup happens before any user exists.
 */

'use strict';

var express = require('express');
var router = express.Router();
var setupService = require('./setup.service');
var config = require('../../config');

/**
 * GET /api/v1/setup/status
 * Check if setup is required
 */
router.get('/status', function(req, res) {
    try {
        var setupRequired = setupService.isSetupRequired();
        var shopConfigured = setupService.isShopConfigured();
        
        res.json({
            setup_required: setupRequired,
            shop_configured: shopConfigured,
            is_production: config.is_production || false
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to check setup status' });
    }
});

/**
 * POST /api/v1/setup/complete
 * Complete the setup process
 */
router.post('/complete', function(req, res) {
    try {
        // Validate setup is still required
        if (!setupService.isSetupRequired()) {
            return res.status(400).json({ error: 'Setup already completed' });
        }
        
        var body = req.body;
        
        // Validate required fields
        if (!body.username || !body.password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        if (body.password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        if (!body.shop || !body.shop.name) {
            return res.status(400).json({ error: 'Shop name is required' });
        }
        
        if (!body.financial_year || !body.financial_year.name || 
            !body.financial_year.start_date || !body.financial_year.end_date) {
            return res.status(400).json({ error: 'Financial year details are required' });
        }
        
        // Complete setup
        var result = setupService.completeSetup({
            username: body.username,
            password: body.password,
            shop: body.shop,
            financial_year: body.financial_year
        });
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Setup completed successfully',
                user_id: result.user_id,
                financial_year: result.financial_year
            });
        } else {
            res.status(500).json({ error: result.error || 'Setup failed' });
        }
        
    } catch (err) {
        console.error('[Setup] Error in complete-setup:', err.message);
        res.status(500).json({ error: 'Setup failed: ' + err.message });
    }
});

/**
 * POST /api/v1/setup/validate-shop
 * Validate shop configuration without saving
 */
router.post('/validate-shop', function(req, res) {
    try {
        var shop = req.body;
        
        var errors = [];
        
        if (!shop.name || shop.name.trim() === '') {
            errors.push('Shop name is required');
        }
        
        if (shop.gstin && shop.gstin.trim() !== '') {
            // Basic GSTIN format validation (15 characters)
            if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(shop.gstin)) {
                errors.push('Invalid GSTIN format');
            }
        }
        
        if (errors.length > 0) {
            res.status(400).json({ valid: false, errors: errors });
        } else {
            res.json({ valid: true });
        }
    } catch (err) {
        res.status(500).json({ error: 'Validation failed' });
    }
});

module.exports = router;
