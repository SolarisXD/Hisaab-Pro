/**
 * Settings Service — Hisaab Pro
 * 
 * Logic for system settings, backups, and security status.
 */

'use strict';

var { db } = require('../../db/database');
var authService = require('../auth/auth.service');
var backup = require('../../../scripts/backup');
var logger = require('../../shared/logger');
var fs = require('fs');
var path = require('path');

/**
 * Get system status (security, backup)
 */
function getSystemStatus() {
    var state = authService.getSecurityState();
    var backupDir = path.join(__dirname, '../../../backups');
    var lastBackup = null;

    if (fs.existsSync(backupDir)) {
        var files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('hisaab-backup-'))
            .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime }))
            .sort((a, b) => b.time - a.time);
        
        if (files.length > 0) {
            lastBackup = {
                filename: files[0].name,
                time: files[0].time
            };
        }
    }

    return {
        security: {
            failed_logins: state.failed_logins,
            last_failure_at: state.last_failure_at,
            is_nuked: state.is_nuked === 1
        },
        backup: {
            last_backup: lastBackup,
            total_backups: fs.existsSync(backupDir) ? fs.readdirSync(backupDir).filter(f => f.startsWith('hisaab-backup-')).length : 0
        }
    };
}

/**
 * Trigger manual backup
 */
function runManualBackup() {
    var backupPath = backup();
    if (backupPath) {
        logger.info('Settings', 'Manual backup triggered successfully');
        return { success: true, path: backupPath };
    } else {
        throw new Error('Backup failed');
    }
}

/**
 * Get system setting by key
 */
function getSystemSetting(key) {
    var row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
    return row ? row.value : null;
}

/**
 * Set system setting
 */
function setSystemSetting(key, value) {
    db.prepare('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\', \'localtime\'))')
        .run(key, String(value));
    return true;
}

/**
 * List financial years
 */
function listFinancialYears() {
    return db.prepare('SELECT * FROM financial_years ORDER BY start_date DESC').all();
}

/**
 * Create financial year
 */
function createFinancialYear(data) {
    var result = db.prepare('INSERT INTO financial_years (name, start_date, end_date, is_active) VALUES (?, ?, ?, 0)')
        .run(data.name, data.start_date, data.end_date);
    return result.lastInsertRowid;
}

/**
 * Activate financial year
 */
function activateFinancialYear(id) {
    var transaction = db.transaction(function() {
        db.prepare('UPDATE financial_years SET is_active = 0').run();
        db.prepare('UPDATE financial_years SET is_active = 1 WHERE id = ?').run(id);
        var fy = db.prepare('SELECT name FROM financial_years WHERE id = ?').get(id);
        setSystemSetting('fy_active', fy.name);
    });
    transaction();
    return true;
}

/**
 * Update shop config (modifies config.json)
 */
function updateShopConfig(data) {
    var configPath = path.resolve(__dirname, '../../../config.json');
    var currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    if (data.shop) {
        Object.assign(currentConfig.shop, data.shop);
    }
    if (data.tax_rate !== undefined) currentConfig.tax_rate = data.tax_rate;
    if (data.invoice_prefix) currentConfig.invoice_prefix = data.invoice_prefix;

    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
    
    // Reload server config
    require('../../config').reloadConfig();
    
    return currentConfig;
}

module.exports = {
    getSystemStatus: getSystemStatus,
    runManualBackup: runManualBackup,
    getSystemSetting,
    setSystemSetting,
    listFinancialYears,
    createFinancialYear,
    activateFinancialYear,
    updateShopConfig
};
