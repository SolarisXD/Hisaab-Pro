/**
 * Sales Routes — Hisaab Pro
 * 
 * GET    /api/v1/sales         — List sales (with filters)
 * GET    /api/v1/sales/:id     — Get single sale with items
 * POST   /api/v1/sales         — Create new sale
 * PUT    /api/v1/sales/:id     — Update sale
 * DELETE /api/v1/sales/:id     — Soft delete sale
 * GET    /api/v1/sales/summary — Sales summary for date range
 */

'use strict';

var express = require('express');
var router = express.Router();
var salesService = require('./sales.service');
var { requireAuth } = require('../auth/auth.middleware');
var { logActivity } = require('../auth/auth.service');

// All sales routes require authentication
router.use(requireAuth);

/**
 * GET / — List sales
 */
router.get('/', function(req, res) {
    try {
        var sales = salesService.listSales({
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            customer_id: req.query.customer_id,
            status: req.query.status,
            search: req.query.search,
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            offset: req.query.offset ? parseInt(req.query.offset) : 0
        }, req.session.user.is_decoy);
        res.json(sales);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /next-ref-no — Get next available reference number
 */
router.get('/next-ref-no', function(req, res) {
    try {
        var nextRefNo = salesService.getNextRefNo(req.session.user.is_decoy);
        res.json({ next_ref_no: nextRefNo });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /next-invoice-no — Get next available invoice number
 */
router.get('/next-invoice-no', function(req, res) {
    try {
        var nextInvoiceNo = salesService.generateInvoiceNumber(req.session.user.is_decoy);
        res.json({ next_invoice_no: nextInvoiceNo });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /summary — Sales summary
 */
router.get('/summary', function(req, res) {
    try {
        var today = new Date().toISOString().split('T')[0];
        var dateFrom = req.query.date_from || today;
        var dateTo = req.query.date_to || today;
        var summary = salesService.getSalesSummary(dateFrom, dateTo, req.session.user.is_decoy);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /:id — Get single sale
 */
router.get('/:id', function(req, res) {
    try {
        var sale = salesService.getSaleById(parseInt(req.params.id), req.session.user.is_decoy);
        if (!sale) {
            return res.status(404).json({ error: 'Sale not found' });
        }
        res.json(sale);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST / — Create new sale
 */
router.post('/', function(req, res) {
    try {
        var sale = salesService.createSale(req.body, req.session.user.is_decoy);
        logActivity(req.session.user.id, 'create_sale', 'sale', sale.id, null, req.ip);
        res.status(201).json(sale);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /:id — Update sale
 */
router.put('/:id', function(req, res) {
    try {
        var sale = salesService.updateSale(parseInt(req.params.id), req.body, req.session.user.is_decoy);
        logActivity(req.session.user.id, 'edit_sale', 'sale', sale.id, null, req.ip);
        res.json(sale);
    } catch (err) {
        if (err.message === 'Sale not found') {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /:id — Soft delete
 */
router.delete('/:id', function(req, res) {
    try {
        salesService.deleteSale(parseInt(req.params.id), req.session.user.is_decoy);
        logActivity(req.session.user.id, 'delete_sale', 'sale', parseInt(req.params.id), null, req.ip);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
