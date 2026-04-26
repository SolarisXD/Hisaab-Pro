/**
 * Logger — Hisaab Pro
 * 
 * Simple console logger with timestamps and log levels.
 * Can be replaced with a file-based logger or external service later.
 */

'use strict';

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Set minimum log level (INFO for production; change to DEBUG for development)
let currentLevel = LOG_LEVELS.INFO;

function getTimestamp() {
    return new Date().toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

function formatMessage(level, module, message, data) {
    var prefix = '[' + getTimestamp() + '] [' + level + ']';
    if (module) {
        prefix += ' [' + module + ']';
    }
    if (data) {
        return prefix + ' ' + message + ' ' + JSON.stringify(data);
    }
    return prefix + ' ' + message;
}

var logger = {
    setLevel: function(level) {
        if (LOG_LEVELS[level] !== undefined) {
            currentLevel = LOG_LEVELS[level];
        }
    },

    debug: function(module, message, data) {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            console.log(formatMessage('DEBUG', module, message, data));
        }
    },

    info: function(module, message, data) {
        if (currentLevel <= LOG_LEVELS.INFO) {
            console.log(formatMessage('INFO', module, message, data));
        }
    },

    warn: function(module, message, data) {
        if (currentLevel <= LOG_LEVELS.WARN) {
            console.warn(formatMessage('WARN', module, message, data));
        }
    },

    error: function(module, message, data) {
        if (currentLevel <= LOG_LEVELS.ERROR) {
            console.error(formatMessage('ERROR', module, message, data));
        }
    }
};

module.exports = logger;
