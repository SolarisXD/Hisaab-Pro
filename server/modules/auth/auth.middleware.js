/**
 * Auth Middleware — Hisaab Pro
 * 
 * Protects routes by checking session authentication and user roles.
 */

'use strict';

var logger = require('../../shared/logger');
var { hasPermission } = require('../../shared/roles');

/**
 * Require authentication — rejects if no valid session
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        logger.warn('Auth', 'Unauthorized access attempt: ' + req.originalUrl);
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

/**
 * Require a specific role
 * Usage: requireRole('owner')
 */
function requireRole(role) {
    return function(req, res, next) {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (req.session.user.role !== role) {
            logger.warn('Auth', 'Access denied — role "' + req.session.user.role + '" tried to access "' + role + '" route');
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    };
}

/**
 * Require a specific permission
 * Usage: requirePermission('can_manage_sales')
 */
function requirePermission(permission) {
    return function(req, res, next) {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!hasPermission(req.session.user.role, permission)) {
            logger.warn('Auth', 'Permission denied — ' + permission + ' for role ' + req.session.user.role);
            return res.status(403).json({ error: 'Permission denied' });
        }
        next();
    };
}

module.exports = {
    requireAuth: requireAuth,
    requireRole: requireRole,
    requirePermission: requirePermission
};
