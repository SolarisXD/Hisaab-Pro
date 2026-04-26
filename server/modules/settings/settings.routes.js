/**
 * Settings Routes — Hisaab Pro
 * 
 * GET  /api/v1/settings/status — System status
 * POST /api/v1/settings/backup — Manual backup
 */

'use strict';

var express = require('express');
var router = express.Router();
var settingsService = require('./settings.service');
var { requireAuth, requireRole } = require('../auth/auth.middleware');
var { loginLimiter } = require('../../shared/rate-limiter');
var { z } = require('zod');

// Validation schemas for settings
var systemSettingSchema = z.object({
    key: z.string().min(1).max(100),
    value: z.string().max(1000)
});

var financialYearSchema = z.object({
    name: z.string().min(1).max(50),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
});

var shopConfigSchema = z.object({
    shop: z.object({
        name: z.string().min(1).max(100),
        address: z.string().max(300).optional(),
        phone: z.string().max(20).optional(),
        gstin: z.string().max(30).optional(),
        logo_path: z.string().max(200).optional()
    }).optional(),
    tax_rate: z.number().min(0).max(100).optional(),
    invoice_prefix: z.string().max(20).optional(),
    backup_path: z.string().max(500).optional()
});

// Rate-limited public endpoint for FY list (needed before login for FY selector)
router.get('/public-financial-years', loginLimiter, function(req, res) {
    try {
        res.json(settingsService.listFinancialYears());
    } catch (err) {
        res.status(500).json({ error: 'Failed to load financial years' });
    }
});

router.use(requireAuth);

/**
 * GET /status
 */
router.get('/status', function(req, res) {
    try {
        var status = settingsService.getSystemStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get system status' });
    }
});

/**
 * POST /backup
 */
router.post('/backup', requireRole('owner'), function(req, res) {
    try {
        var result = settingsService.runManualBackup();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Backup failed' });
    }
});

/**
 * GET /system-settings/:key
 */
router.get('/system-settings/:key', function(req, res) {
    try {
        var val = settingsService.getSystemSetting(req.params.key);
        res.json({ key: req.params.key, value: val });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get setting' });
    }
});

/**
 * POST /system-settings — Validated
 */
router.post('/system-settings', requireRole('owner'), function(req, res) {
    try {
        var parsed = systemSettingSchema.parse(req.body);
        settingsService.setSystemSetting(parsed.key, parsed.value);
        res.json({ success: true });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        res.status(500).json({ error: 'Failed to save setting' });
    }
});

/**
 * GET /financial-years
 */
router.get('/financial-years', function(req, res) {
    try {
        res.json(settingsService.listFinancialYears());
    } catch (err) {
        res.status(500).json({ error: 'Failed to list financial years' });
    }
});

/**
 * POST /financial-years — Validated
 */
router.post('/financial-years', requireRole('owner'), function(req, res) {
    try {
        var parsed = financialYearSchema.parse(req.body);
        var id = settingsService.createFinancialYear(parsed);
        res.status(201).json({ id: id });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        res.status(500).json({ error: err.message || 'Failed to create financial year' });
    }
});

/**
 * POST /financial-years/:id/activate
 */
router.post('/financial-years/:id/activate', requireRole('owner'), function(req, res) {
    try {
        settingsService.activateFinancialYear(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to activate financial year' });
    }
});

/**
 * PUT /shop-config — Validated
 */
router.put('/shop-config', requireRole('owner'), function(req, res) {
    try {
        var parsed = shopConfigSchema.parse(req.body);
        var updated = settingsService.updateShopConfig(parsed);
        res.json(updated);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        res.status(500).json({ error: 'Failed to update shop config' });
    }
});

module.exports = router;
