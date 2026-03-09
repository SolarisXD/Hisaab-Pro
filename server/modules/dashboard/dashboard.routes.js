/**
 * Dashboard Routes — Hisaab Pro
 * 
 * GET /api/v1/dashboard — Returns all dashboard summary data
 */

'use strict';

var express = require('express');
var router = express.Router();
var dashboardService = require('./dashboard.service');
var { requireAuth } = require('../auth/auth.middleware');

router.use(requireAuth);

/**
 * GET / — Dashboard data
 */
router.get('/', function(req, res) {
    try {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        var data = dashboardService.getDashboardData(req.session.user.is_decoy);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
