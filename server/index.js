/**
 * Hisaab Pro — Server Entry Point
 * 
 * Express server serving the API and static frontend.
 * Run: `node server/index.js` or `npm start`
 */

'use strict';

var express = require('express');
var session = require('express-session');
var cors = require('cors');
var path = require('path');
var config = require('./config');
var logger = require('./shared/logger');

// Initialize database (runs schema on first load)
var { db, closeDb, fyRequestContext } = require('./db/database');

// Import route modules
var authRoutes = require('./modules/auth/auth.routes');
var salesRoutes = require('./modules/sales/sales.routes');
var paymentsRoutes = require('./modules/payments/payments.routes');
var accountsRoutes = require('./modules/accounts/accounts.routes');
var dashboardRoutes = require('./modules/dashboard/dashboard.routes');
var reportsRoutes = require('./modules/reports/reports.routes');
var settingsRoutes = require('./modules/settings/settings.routes');
var purchasesRoutes = require('./modules/purchases/purchases.routes');
var backup = require('../scripts/backup');

// Create Express app
var app = express();

// ============================================================
// MIDDLEWARE
// ============================================================

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// CORS (for development)
app.use(cors({
    origin: true,
    credentials: true
}));

// Session management
app.use(session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: config.session.timeout_minutes * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../client')));

// ============================================================
// API ROUTES (all under /api/v1/)
// ============================================================

// Wrap all API requests in the requested Financial Year context
app.use('/api/v1', function(req, res, next) {
    // Prevent browser caching of API responses (crucial for FY switching)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    var requestedFy = req.headers['x-financial-year'];
    
    // If not specified, default to whatever is globally active or hisaab.db
    if (!requestedFy) {
        requestedFy = config.database.active_database || 'hisaab.db';
    }
    
    fyRequestContext(requestedFy, function() {
        next();
    });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/sales', salesRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/accounts', accountsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/purchases', purchasesRoutes);

// ============================================================
// CONFIG ENDPOINT (public — sends non-sensitive shop info to frontend)
// ============================================================

app.get('/api/v1/config', function(req, res) {
    res.json({
        shop: config.shop,
        currency: config.currency,
        currency_symbol: config.currency_symbol,
        tax_rate: config.tax_rate,
        invoice_prefix: config.invoice_prefix,
        locale: config.locale
    });
});

// ============================================================
// CATCH-ALL: Serve index.html for SPA-style navigation
// ============================================================

app.get('*', function(req, res) {
    // Only serve HTML for non-API, non-asset requests
    if (!req.path.startsWith('/api/') && !req.path.includes('.')) {
        res.sendFile(path.join(__dirname, '../client/index.html'));
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(function(err, req, res, next) {
    logger.error('Server', 'Unhandled error: ' + err.message);
    res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// START SERVER
// ============================================================

var PORT = config.server.port;
var HOST = config.server.host;

app.listen(PORT, HOST, function() {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║         HISAAB PRO — Business Ledger     ║');
    console.log('  ╠══════════════════════════════════════════╣');
    console.log('  ║  Server:  http://' + HOST + ':' + PORT + '          ║');
    console.log('  ║  Shop:    ' + config.shop.name.substring(0, 30).padEnd(30) + '  ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
    logger.info('Server', 'Started on http://' + HOST + ':' + PORT);

    // Schedule backups every 24 hours (or at specific time)
    // For demo/simplicity, we just run it every 24 hours from start
    setInterval(function() {
        console.log('[Scheduler] Running scheduled backup...');
        backup();
    }, 24 * 60 * 60 * 1000);
});

// Graceful shutdown
process.on('SIGINT', function() {
    logger.info('Server', 'Shutting down...');
    closeDb();
    process.exit(0);
});

process.on('SIGTERM', function() {
    logger.info('Server', 'Shutting down...');
    closeDb();
    process.exit(0);
});

module.exports = app;
