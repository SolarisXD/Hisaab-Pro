/**
 * Hisaab Pro — Server Entry Point
 * 
 * Express server serving the API and static frontend.
 * Run: `node server/index.js` or `npm start`
 */

'use strict';

var express = require('express');
var session = require('express-session');
var helmet = require('helmet');
var cors = require('cors');
var path = require('path');
var config = require('./config');
var logger = require('./shared/logger');
var { resolvePath } = require('./shared/paths');
var { standardLimiter } = require('./shared/rate-limiter');

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
var uploadsRoutes = require('./modules/uploads/uploads.routes');
var staffRoutes = require('./modules/staff/staff.routes');
var backup = require('../scripts/backup');

// Create Express app
var app = express();

// Import auth middleware for protecting routes
var { requireAuth } = require('./modules/auth/auth.middleware');

// ============================================================
// MIDDLEWARE
// ============================================================

// Security headers (XSS protection, Content-Type sniffing, etc.)
app.use(helmet({
    contentSecurityPolicy: false  // Disabled — we serve inline scripts in vanilla HTML
}));

// Parse JSON bodies (limit size to prevent memory exhaustion)
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded bodies (limit size)
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// CORS — locked down to localhost only (this is a private pendrive app)
var allowedOrigin = 'http://' + (config.server.host || 'localhost') + ':' + (config.server.port || 3000);
app.use(cors({
    origin: allowedOrigin,
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
        sameSite: 'lax',
        secure: config.server.host !== 'localhost' && config.server.host !== '127.0.0.1'
    }
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../client')));

// Serve static uploaded files — PROTECTED by auth (bill images contain sensitive data)
app.use('/data/uploads', requireAuth, express.static(resolvePath('data', 'uploads')));

// ============================================================
// API ROUTES (all under /api/v1/)
// ============================================================

// Rate limit all API routes (100 requests / 15 min per IP)
app.use('/api/v1', standardLimiter);

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
    
    // SECURITY: Validate FY header to prevent path traversal
    // Only allow safe filenames: alphanumeric, underscores, hyphens, dots, ending in .db
    var safeFilenameRegex = /^[a-zA-Z0-9_\-\.]+\.db$/;
    if (!safeFilenameRegex.test(requestedFy) || requestedFy.includes('..') || requestedFy.includes('/') || requestedFy.includes('\\')) {
        logger.warn('Security', 'Rejected invalid x-financial-year header: ' + requestedFy);
        return res.status(400).json({ error: 'Invalid financial year identifier' });
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
app.use('/api/v1/uploads', uploadsRoutes);
app.use('/api/v1/staff', staffRoutes);

// ============================================================
// CONFIG ENDPOINT (protected — sends shop info to authenticated frontend)
// ============================================================

app.get('/api/v1/config', requireAuth, function(req, res) {
    res.json({
        shop: config.shop,
        currency: config.currency,
        currency_symbol: config.currency_symbol,
        tax_rate: config.tax_rate,
        invoice_prefix: config.invoice_prefix,
        locale: config.locale,
        backup_path: config.backup && config.backup.custom_path ? config.backup.custom_path : ''
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
// ERROR HANDLER — Never leak internal details to the client
// ============================================================

app.use(function(err, req, res, next) {
    logger.error('Server', 'Unhandled error: ' + err.message, { stack: err.stack });
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

    // Auto-backup on start (if enabled in config)
    if (config.backup && config.backup.auto_start) {
        console.log('[Auto-Backup] Creating backup on server start...');
        try {
            backup();
        } catch (err) {
            console.error('[Auto-Backup] Start backup failed:', err.message);
        }
    }

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
    
    // Auto-backup on exit (if enabled in config)
    if (config.backup && config.backup.auto_exit) {
        console.log('[Auto-Backup] Creating backup on server exit...');
        try {
            backup();
        } catch (err) {
            console.error('[Auto-Backup] Exit backup failed:', err.message);
        }
    }
    
    closeDb();
    process.exit(0);
});

process.on('SIGTERM', function() {
    logger.info('Server', 'Shutting down...');
    
    // Auto-backup on exit (if enabled in config)
    if (config.backup && config.backup.auto_exit) {
        console.log('[Auto-Backup] Creating backup on server exit...');
        try {
            backup();
        } catch (err) {
            console.error('[Auto-Backup] Exit backup failed:', err.message);
        }
    }
    
    closeDb();
    process.exit(0);
});

module.exports = app;
