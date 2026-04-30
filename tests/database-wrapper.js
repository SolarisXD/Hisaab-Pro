/**
 * Database Wrapper — Test Helper
 * 
 * This module wraps the actual database.js to allow testing
 * without affecting the real database connections.
 */

'use strict';

// Re-export everything from the actual database module
const dbModule = require('../server/db/database');

module.exports = dbModule;

// Helper for tests to get a fresh instance
// Note: getDbInstance is now exported directly from database.js
// This wrapper just re-exports it for convenience
if (typeof dbModule.getDbInstance === 'function') {
    module.exports.getDbInstance = dbModule.getDbInstance;
}
