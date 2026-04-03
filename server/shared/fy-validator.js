/**
 * Financial Year Validator — Hisaab Pro
 * 
 * Ensures transactions aren't backdated before the operational start of the FY (April 1st).
 */

'use strict';

var config = require('../config');

/**
 * Validates if a date string (YYYY-MM-DD) falls within the allowed financial year range.
 * Defaults to 1st April of the start year in config if no specific start exists.
 */
function validateTransactionDate(dateStr) {
    if (!dateStr) return true; // Let other validation handle missing dates

    var txDate = new Date(dateStr);
    if (isNaN(txDate.getTime())) throw new Error('Invalid date format');

    var activeFy = null;
    var activeDbName = config.database.active_database || 'hisaab.db';

    // Find the current FY in config
    if (config.financial_years && config.financial_years.length > 0) {
        activeFy = config.financial_years.find(y => y.db_filename === activeDbName);
    }

    // Default: If it's the legacy root DB, we don't enforce strict April 1st unless specified
    if (!activeFy || activeDbName === 'hisaab.db') {
        return true; 
    }

    var fyStart = new Date(activeFy.start_date);
    var fyEnd = new Date(activeFy.end_date);

    if (txDate < fyStart) {
        throw new Error(`Transaction date (${dateStr}) cannot be before the Financial Year start (${activeFy.start_date})`);
    }

    if (txDate > fyEnd) {
        throw new Error(`Transaction date (${dateStr}) cannot be after the Financial Year end (${activeFy.end_date})`);
    }

    return true;
}

module.exports = {
    validateTransactionDate
};
