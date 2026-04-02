'use strict';

const config = require('../config');

/**
 * Validates if the given date string (YYYY-MM-DD or ISO) falls within the active financial year.
 * If there is no active financial year or matching FY details, it allows the date.
 * 
 * @param {string} dateStr - The date to validate
 * @param {string} dbName - The active database name (e.g. req.headers['x-financial-year'] or default)
 * @returns {boolean} True if valid, false if clearly out of range
 */
function isDateInActiveFY(dateStr, dbName) {
    if (!dateStr) {
        var now = new Date();
        var offset = now.getTimezoneOffset() * 60000;
        dateStr = (new Date(now.getTime() - offset)).toISOString().split('T')[0];
    }

    const activeDb = dbName || config.database.active_database || 'hisaab.db';
    const fylist = config.financial_years || [];
    const fy = fylist.find(f => f.db_filename === activeDb);

    if (!fy || !fy.start_date || !fy.end_date) {
        return true; // No strict FY bounds to enforce
    }

    const txDate = new Date(dateStr);
    const startDate = new Date(fy.start_date);
    
    // Set end date to the end of the day to ensure transactions on the last day are permitted
    const endDate = new Date(fy.end_date);
    endDate.setHours(23, 59, 59, 999);

    if (isNaN(txDate.getTime())) return false; // Invalid date

    return txDate >= startDate && txDate <= endDate;
}

module.exports = {
    isDateInActiveFY
};
