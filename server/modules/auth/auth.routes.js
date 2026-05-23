/**
 * Auth Routes — Hisaab Pro
 * 
 * POST /api/v1/auth/login    — Login
 * POST /api/v1/auth/logout   — Logout
 * GET  /api/v1/auth/me       — Current user info
 * POST /api/v1/auth/change-password — Change password
 */

'use strict';

var express = require('express');
var router = express.Router();
var authService = require('./auth.service');
var { requireAuth } = require('./auth.middleware');
var { loginLimiter } = require('../../shared/rate-limiter');
var logger = require('../../shared/logger');

/**
 * POST /login
 */
router.post('/login', loginLimiter, function(req, res) {
    var username = req.body.username;
    var password = req.body.password;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        var user = authService.login(username, password, req.ip);
        
        // Set session
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            is_decoy: user.is_decoy
        };

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (err) {
        logger.error('Auth', 'Login failed: ' + err.message, { stack: err.stack });
        res.status(401).json({ error: err.message });
    }
});

/**
 * POST /logout
 */
router.post('/logout', function(req, res) {
    var userId = req.session && req.session.user ? req.session.user.id : null;

    if (userId) {
        authService.logActivity(userId, 'logout', 'user', userId, null, req.ip);
    }

    req.session.destroy(function(err) {
        if (err) {
            logger.error('Auth', 'Session destroy failed', err);
        }
        res.json({ success: true });
    });
});

/**
 * GET /me — Current user info
 */
router.get('/me', requireAuth, function(req, res) {
    var user = authService.getUserById(req.session.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        created_at: user.created_at
    });
});

/**
 * POST /change-password
 */
router.post('/change-password', requireAuth, function(req, res) {
    var oldPassword = req.body.old_password;
    var newPassword = req.body.new_password;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Old and new passwords are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    try {
        authService.changePassword(req.session.user.id, oldPassword, newPassword);
        authService.logActivity(req.session.user.id, 'change_password', 'user', req.session.user.id, null, req.ip);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/setup-status', async (req, res) => {
    try {
        const isFirstTime = await authService.isFirstTime();
        res.json({ is_first_time: isFirstTime });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check setup status' });
    }
});

// Check if system has any users (Initialized)
router.get('/status', (req, res) => {
    try {
        const count = authService.getUserCount();
        res.json({ initialized: count > 0 });
    } catch (err) {
        res.status(500).json({ error: 'Failed to check system status' });
    }
});

router.post('/signup', loginLimiter, async (req, res) => {
    try {
        const isFirstTime = await authService.isFirstTime();
        if (!isFirstTime) {
            return res.status(400).json({ error: 'System already setup' });
        }

        const { shopDetails, ownerUser, financialYear } = req.body;
        if (!shopDetails || !ownerUser || !financialYear || !financialYear.name) {
            return res.status(400).json({ error: 'Missing details' });
        }

        const result = await authService.signup(shopDetails, ownerUser, financialYear);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Signup failed. Please try again.' });
    }
});

module.exports = router;
