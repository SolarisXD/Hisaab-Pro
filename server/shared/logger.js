/**
 * Logger — Hisaab Pro
 * 
 * File-based logger with timestamps, log levels, and automatic log rotation.
 * Logs are written to logs/ directory in JSON format for easy parsing.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { appRootDir, resolvePath } = require('./paths');

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Set minimum log level (INFO for production; change to DEBUG for development)
let currentLevel = LOG_LEVELS.INFO;

// Log file configuration
const LOG_DIR = resolvePath('logs');
const LOG_FILE_NAME = 'app.log';
const LOG_FILE_PATH = path.join(LOG_DIR, LOG_FILE_NAME);
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024; // 10MB rotation threshold

/**
 * Ensure the logs directory exists
 */
function ensureLogDir() {
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
    } catch (err) {
        // Log to console only - can't log to file if log dir fails
        console.error('[Logger] Failed to create logs directory:', err.message);
    }
}

/**
 * Get current timestamp in ISO format for consistent parsing
 */
function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Format log entry as JSON for parseable output
 */
function formatLogEntry(level, module, message, data) {
    var entry = {
        timestamp: getTimestamp(),
        level: level,
        module: module || 'Unknown',
        message: message || ''
    };
    
    if (data !== undefined && data !== null) {
        entry.data = data;
    }
    
    return JSON.stringify(entry);
}

/**
 * Write a log entry to the log file with rotation support
 */
function writeToFile(logEntry) {
    try {
        ensureLogDir();
        
        // Check if log file needs rotation
        if (fs.existsSync(LOG_FILE_PATH)) {
            const stats = fs.statSync(LOG_FILE_PATH);
            if (stats.size >= MAX_LOG_FILE_SIZE) {
                rotateLogFile();
            }
        }
        
        // Append the log entry
        fs.appendFileSync(LOG_FILE_PATH, logEntry + '\n', 'utf8');
    } catch (err) {
        // Don't throw - log the error to console instead to avoid silent failure
        console.error('[Logger] Failed to write to log file:', err.message);
    }
}

/**
 * Rotate the current log file by renaming it with timestamp
 */
function rotateLogFile() {
    try {
        if (!fs.existsSync(LOG_FILE_PATH)) {
            return; // Nothing to rotate
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFileName = 'app-' + timestamp + '.log';
        const rotatedPath = path.join(LOG_DIR, rotatedFileName);
        
        fs.renameSync(LOG_FILE_PATH, rotatedPath);
    } catch (err) {
        console.error('[Logger] Failed to rotate log file:', err.message);
    }
}

/**
 * Core log function that handles both console and file output
 */
function log(level, module, message, data) {
    if (LOG_LEVELS[level] === undefined || LOG_LEVELS[level] < currentLevel) {
        return;
    }
    
    var logEntry = formatLogEntry(level, module, message, data);
    
    // Console output with appropriate method
    var consoleMethod = console.log;
    if (level === 'ERROR') consoleMethod = console.error;
    if (level === 'WARN') consoleMethod = console.warn;
    
    consoleMethod(logEntry);
    
    // File output
    writeToFile(logEntry);
}

var logger = {
    setLevel: function(level) {
        if (LOG_LEVELS[level] !== undefined) {
            currentLevel = LOG_LEVELS[level];
        }
    },

    debug: function(module, message, data) {
        log('DEBUG', module, message, data);
    },

    info: function(module, message, data) {
        log('INFO', module, message, data);
    },

    warn: function(module, message, data) {
        log('WARN', module, message, data);
    },

    error: function(module, message, data) {
        log('ERROR', module, message, data);
    },
    
    /**
     * Get the current log file path (for testing)
     */
    _getLogFilePath: function() {
        return LOG_FILE_PATH;
    },
    
    /**
     * Get the log directory path (for testing)
     */
    _getLogDir: function() {
        return LOG_DIR;
    },
    
    /**
     * Get LOG_LEVELS (for testing)
     */
    _getLogLevels: function() {
        return LOG_LEVELS;
    }
};

module.exports = logger;
