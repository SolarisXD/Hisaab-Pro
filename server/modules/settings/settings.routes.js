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

router.use('/public-financial-years', function(req, res) {
    res.json(settingsService.listFinancialYears());
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
        res.status(500).json({ error: err.message });
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
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /system-settings/:key
 */
router.get('/system-settings/:key', function(req, res) {
    var val = settingsService.getSystemSetting(req.params.key);
    res.json({ key: req.params.key, value: val });
});

/**
 * POST /system-settings
 */
router.post('/system-settings', requireRole('owner'), function(req, res) {
    settingsService.setSystemSetting(req.body.key, req.body.value);
    res.json({ success: true });
});

/**
 * GET /financial-years
 */
router.get('/financial-years', function(req, res) {
    res.json(settingsService.listFinancialYears());
});

/**
 * POST /financial-years
 */
router.post('/financial-years', requireRole('owner'), function(req, res) {
    var id = settingsService.createFinancialYear(req.body);
    res.status(201).json({ id: id });
});

/**
 * POST /financial-years/:id/activate
 */
router.post('/financial-years/:id/activate', requireRole('owner'), function(req, res) {
    settingsService.activateFinancialYear(req.params.id);
    res.json({ success: true });
});

/**
 * PUT /shop-config
 */
router.put('/shop-config', requireRole('owner'), function(req, res) {
    try {
        var updated = settingsService.updateShopConfig(req.body);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
