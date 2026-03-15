/**
 * Settings Service — Hisaab Pro
 * 
 * Logic for system settings, backups, and security status.
 */

'use strict';

var { db } = require('../../db/database');
var backup = require('../../../scripts/backup');
var logger = require('../../shared/logger');
var fs = require('fs');
var path = require('path');
var config = require('../../config');
var dbManager = require('../../db/database');

/**
 * Get system status (security, backup)
 */
function getSystemStatus() {
    var state = dbManager.fyRequestContext('hisaab.db', () => {
        return db.prepare('SELECT * FROM security_state WHERE id = 1').get();
    });
    
    var config = require('../../config');
    var activeDb = config.database.active_database || 'hisaab.db';
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
        },
        database: {
            active_file: activeDb
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
 * Helper to write to config.json safely
 */
function saveConfigToFile(newConfig) {
    var configPath = path.resolve(__dirname, '../../../config.json');
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
    require('../../config').reloadConfig();
}

/**
 * List financial years (Now reads from config.json)
 */
function listFinancialYears() {
    var currentConfig = require('../../config');
    var years = currentConfig.financial_years || [];
    var activeDb = currentConfig.database.active_database;

    return years.map(y => ({
        id: y.id,
        name: y.name,
        start_date: y.start_date,
        end_date: y.end_date,
        db_filename: y.db_filename,
        is_active: (y.db_filename === activeDb) ? 1 : 0
    })).sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
}

/**
 * Create financial year (Creates new DB file, wipes transactions, carries balances)
 */
function createFinancialYear(data) {
    var currentConfig = require('../../config');
    var activeDbName = currentConfig.database.active_database || 'hisaab.db';
    
    // Auto-generate a safe filename for the new year
    var safeName = data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    var newDbFilename = `hisaab_${safeName}_${Date.now()}.db`;
    
    // 1. Physically copy the current database
    var dbDirPath = path.dirname(path.resolve(__dirname, '../../../', currentConfig.database.path));
    var sourcePath = path.join(dbDirPath, activeDbName);
    var targetPath = path.join(dbDirPath, newDbFilename);
    
    // Force a checkpoint on current DB before copying to ensure all WAL data is written
    try {
        dbManager.getDb().pragma('wal_checkpoint(TRUNCATE)');
    } catch(e) {}
    
    fs.copyFileSync(sourcePath, targetPath);
    
    // 2. Open temporary connection to the NEW database to wipe data
    var Database = require('better-sqlite3-multiple-ciphers');
    var tempDb = new Database(targetPath);
    var dbKey = currentConfig.database_key || 'hisaab-pro-default-key-2026';
    tempDb.pragma(`key = '${dbKey}'`);
    
    // Disable foreign keys temporarily while wiping data
    tempDb.pragma('foreign_keys = OFF');
    
    // 3. Perform the Year-End Wipe and Balance Carry-Forward
    var wipeTransaction = tempDb.transaction(() => {
        // Carry closing balances to opening balances
        tempDb.prepare('UPDATE accounts SET opening_balance = current_balance').run();
        
        // Wipe all transactional tables (Order matters even with FK off, just to be safe)
        tempDb.prepare('DELETE FROM transactions').run();
        tempDb.prepare('DELETE FROM payments').run();
        tempDb.prepare('DELETE FROM sales_items').run();
        tempDb.prepare('DELETE FROM sales').run();
        tempDb.prepare('DELETE FROM purchases').run();
        
        // Reset sqlite sequences (auto-increment IDs) for clean start
        tempDb.prepare("UPDATE sqlite_sequence SET seq = 0 WHERE name IN ('sales', 'sales_items', 'purchases', 'payments', 'transactions')").run();
        
        // Clear activity log but keep security state
        tempDb.prepare('DELETE FROM activity_log').run();
    });
    
    wipeTransaction();
    
    // Re-enable foreign keys
    tempDb.pragma('foreign_keys = ON');
    tempDb.close();
    
    // 4. Save to config.json
    var years = currentConfig.financial_years || [];
    var newId = years.length > 0 ? Math.max(...years.map(y => y.id)) + 1 : 1;
    
    var newFy = {
        id: newId,
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        db_filename: newDbFilename
    };
    
    years.push(newFy);
    
    // Reload full config from disk to avoid object reference issues before mutating
    var configPath = path.resolve(__dirname, '../../../config.json');
    var rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    rawConfig.financial_years = years;
    
    saveConfigToFile(rawConfig);
    
    logger.info('Settings', `Created new Financial Year: ${data.name} mapped to ${newDbFilename}`);
    
    return newId;
}

/**
 * Activate financial year (Switches the active database)
 */
function activateFinancialYear(id) {
    var rawConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../config.json'), 'utf-8'));
    var years = rawConfig.financial_years || [];
    
    var fyFilename;
    var fyName;
    
    if (id === 'legacy') {
        fyFilename = 'hisaab.db';
        fyName = 'Current/Legacy Data';
    } else {
        var fy = years.find(y => y.id == id);
        if (!fy) throw new Error('Financial year not found');
        fyFilename = fy.db_filename;
        fyName = fy.name;
    }
    
    // Update active database in config
    if (!rawConfig.database) rawConfig.database = {};
    rawConfig.database.active_database = fyFilename;
    
    saveConfigToFile(rawConfig);
    
    // Tell the database manager to switch connections immediately
    dbManager.switchDatabase(fyFilename);
    
    logger.info('Settings', `Activated Financial Year: ${fyName}`);
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
