/**
 * Backup Script — Hisaab Pro
 * 
 * Creates a timestamped copy of the database.
 * Run: `node scripts/backup.js`
 */

const fs = require('fs');
const path = require('path');

const config = require('../server/config');
const activeDbName = config.database.active_database || 'hisaab.db';
const DB_PATH = path.join(__dirname, '../data', activeDbName);
const BACKUP_DIR = (config.backup && config.backup.custom_path) ? config.backup.custom_path : path.join(__dirname, '../backups');

function backup() {
    if (!fs.existsSync(DB_PATH)) {
        console.error('Database file not found at:', DB_PATH);
        return;
    }

    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `hisaab-backup-${timestamp}.db`);

    try {
        // Use copyFileSync to copy the database
        fs.copyFileSync(DB_PATH, backupPath);
        console.log('Backup created successfully:', backupPath);
        
        // Keep only last 7 backups to save space
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('hisaab-backup-'))
            .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);
        
        if (files.length > 7) {
            for (let i = 7; i < files.length; i++) {
                fs.unlinkSync(path.join(BACKUP_DIR, files[i].name));
                console.log('Removed old backup:', files[i].name);
            }
        }
        return backupPath;
    } catch (err) {
        console.error('Backup failed:', err);
    }
}

if (require.main === module) {
    backup();
}

module.exports = backup;
