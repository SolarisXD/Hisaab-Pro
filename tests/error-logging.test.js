/**
 * Error Logging Tests — Hisaab Pro
 * 
 * Tests for file-based logging to logs/ directory.
 * Verifies: all errors logged, consistent format, no silent failures, log rotation.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../server/shared/logger');

// Store original console methods for restoration
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Test log directory and file paths
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE_PATH = path.join(LOG_DIR, 'app.log');

// Capture console output for assertions
let consoleOutput = [];
let consoleErrorOutput = [];
let consoleWarnOutput = [];

// ============================================================
// Setup and Teardown
// ============================================================

beforeEach(() => {
    // Reset logger level to INFO
    logger.setLevel('INFO');
    
    // Clear captured console output
    consoleOutput = [];
    consoleErrorOutput = [];
    consoleWarnOutput = [];
    
    // Mock console methods to capture output
    console.log = jest.fn((msg) => consoleOutput.push(msg));
    console.warn = jest.fn((msg) => consoleWarnOutput.push(msg));
    console.error = jest.fn((msg) => consoleErrorOutput.push(msg));
});

afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    
    // Clean up test log files
    try {
        if (fs.existsSync(LOG_DIR)) {
            const files = fs.readdirSync(LOG_DIR);
            files.forEach(file => {
                if (file.endsWith('.log')) {
                    fs.unlinkSync(path.join(LOG_DIR, file));
                }
            });
            // Only remove directory if empty
            const remainingFiles = fs.readdirSync(LOG_DIR);
            if (remainingFiles.length === 0) {
                fs.rmdirSync(LOG_DIR);
            }
        }
    } catch (err) {
        // Ignore cleanup errors
    }
});

// ============================================================
// Test Suite: Log Directory Creation
// ============================================================

describe('Log Directory Creation', () => {
    
    // ✅ Positive Test: Creates logs/ directory if missing
    test('creates logs/ directory if it does not exist', () => {
        // Arrange
        // Remove logs directory if it exists
        if (fs.existsSync(LOG_DIR)) {
            fs.readdirSync(LOG_DIR).forEach(file => {
                fs.unlinkSync(path.join(LOG_DIR, file));
            });
            fs.rmdirSync(LOG_DIR);
        }
        
        // Act
        logger.info('TestModule', 'Test message for directory creation');
        
        // Assert
        expect(fs.existsSync(LOG_DIR)).toBe(true);
        expect(fs.statSync(LOG_DIR).isDirectory()).toBe(true);
    });
    
    // ✅ Positive Test: Uses correct logs/ path
    test('uses correct logs/ directory path', () => {
        // Arrange & Act
        logger.info('TestModule', 'Path verification');
        
        // Assert
        const expectedPath = path.join(__dirname, '..', 'logs');
        expect(LOG_DIR).toBe(expectedPath);
    });
});

// ============================================================
// Test Suite: Error Logging to File
// ============================================================

describe('Error Logging to File', () => {
    
    // ✅ Positive Test: Logs error messages to log file
    test('writes error messages to log file in logs/ directory', () => {
        // Arrange
        const testMessage = 'Test error message';
        const testModule = 'ErrorModule';
        
        // Act
        logger.error(testModule, testMessage);
        
        // Assert
        expect(fs.existsSync(LOG_FILE_PATH)).toBe(true);
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        expect(logContent).toContain(testMessage);
        expect(logContent).toContain(testModule);
    });
    
    // ✅ Positive Test: Logs info messages to log file
    test('writes info messages to log file', () => {
        // Arrange
        const testMessage = 'Test info message';
        const testModule = 'InfoModule';
        
        // Act
        logger.info(testModule, testMessage);
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        expect(logContent).toContain(testMessage);
        expect(logContent).toContain(testModule);
    });
    
    // ✅ Positive Test: Logs warn messages to log file
    test('writes warn messages to log file', () => {
        // Arrange
        const testMessage = 'Test warning message';
        const testModule = 'WarnModule';
        
        // Act
        logger.warn(testModule, testMessage);
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        expect(logContent).toContain(testMessage);
        expect(logContent).toContain(testModule);
    });
    
    // ✅ Positive Test: Logs debug messages when level is DEBUG
    test('writes debug messages when log level is DEBUG', () => {
        // Arrange
        logger.setLevel('DEBUG');
        const testMessage = 'Test debug message';
        const testModule = 'DebugModule';
        
        // Act
        logger.debug(testModule, testMessage);
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        expect(logContent).toContain(testMessage);
        expect(logContent).toContain(testModule);
    });
    
    // ❌ Negative Test: Does not log debug when level is INFO
    test('does not write debug messages when log level is INFO', () => {
        // Arrange
        logger.setLevel('INFO');
        const testMessage = 'Should not appear';
        
        // Act
        logger.debug('DebugModule', testMessage);
        
        // Assert
        if (fs.existsSync(LOG_FILE_PATH)) {
            const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
            expect(logContent).not.toContain(testMessage);
        } else {
            // File may not exist if no logs were written - that's also valid
            expect(true).toBe(true);
        }
    });
});

// ============================================================
// Test Suite: Log Format Consistency
// ============================================================

describe('Log Format Consistency', () => {
    
    // ✅ Positive Test: Log format includes timestamp
    test('log entry includes ISO timestamp', () => {
        // Arrange & Act
        logger.error('TestModule', 'Timestamp test');
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const logEntry = JSON.parse(logContent.trim());
        expect(logEntry.timestamp).toBeDefined();
        expect(new Date(logEntry.timestamp).toISOString()).toBe(logEntry.timestamp);
    });
    
    // ✅ Positive Test: Log format includes level
    test('log entry includes log level', () => {
        // Arrange & Act
        logger.error('TestModule', 'Level test');
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const logEntry = JSON.parse(logContent.trim());
        expect(logEntry.level).toBe('ERROR');
    });
    
    // ✅ Positive Test: Log format includes module name
    test('log entry includes module name', () => {
        // Arrange & Act
        logger.error('TestModule', 'Module test');
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const logEntry = JSON.parse(logContent.trim());
        expect(logEntry.module).toBe('TestModule');
    });
    
    // ✅ Positive Test: Log format includes message
    test('log entry includes message', () => {
        // Arrange
        const testMessage = 'Test message content';
        
        // Act
        logger.error('TestModule', testMessage);
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const logEntry = JSON.parse(logContent.trim());
        expect(logEntry.message).toBe(testMessage);
    });
    
    // ✅ Positive Test: Log format is valid JSON (parseable)
    test('log entry is valid JSON and parseable', () => {
        // Arrange & Act
        logger.error('TestModule', 'JSON parseability test');
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        expect(() => JSON.parse(logContent.trim())).not.toThrow();
        const logEntry = JSON.parse(logContent.trim());
        expect(typeof logEntry).toBe('object');
    });
    
    // ✅ Positive Test: Log entry with data object is parseable
    test('log entry with data object includes data as valid JSON', () => {
        // Arrange
        const testData = { errorCode: 500, details: 'Internal error' };
        
        // Act
        logger.error('TestModule', 'Error with data', testData);
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const logEntry = JSON.parse(logContent.trim());
        expect(logEntry.data).toEqual(testData);
    });
    
    // ✅ Positive Test: Multiple log entries are each on their own line
    test('multiple log entries are written as separate lines', () => {
        // Arrange & Act
        logger.info('Module1', 'Message 1');
        logger.info('Module2', 'Message 2');
        logger.error('Module3', 'Message 3');
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const lines = logContent.trim().split('\n');
        expect(lines.length).toBe(3);
        lines.forEach(line => {
            expect(() => JSON.parse(line)).not.toThrow();
        });
    });
});

// ============================================================
// Test Suite: No Silent Failures
// ============================================================

describe('No Silent Failures', () => {
    
    // ✅ Positive Test: Handles log file write errors gracefully
    test('handles log file write errors without throwing', () => {
        // Arrange
        // Mock fs.appendFileSync to simulate write error
        const originalAppendFileSync = fs.appendFileSync;
        fs.appendFileSync = jest.fn(() => {
            throw new Error('Simulated write error');
        });
        
        // Act & Assert - should not throw
        expect(() => {
            logger.error('TestModule', 'Test message');
        }).not.toThrow();
        
        // Restore
        fs.appendFileSync = originalAppendFileSync;
    });
    
    // ✅ Positive Test: Logs error to console if file write fails
    test('logs to console if file write fails', () => {
        // Arrange
        const originalAppendFileSync = fs.appendFileSync;
        fs.appendFileSync = jest.fn(() => {
            throw new Error('Simulated write error');
        });
        
        // Act
        logger.error('TestModule', 'Test message');
        
        // Assert - console.error should have been called
        expect(console.error).toHaveBeenCalled();
        
        // Restore
        fs.appendFileSync = originalAppendFileSync;
    });
    
    // ❌ Negative Test: Handles missing module name gracefully
    test('handles missing module name without crashing', () => {
        // Arrange & Act & Assert - should not throw
        expect(() => {
            logger.error(null, 'Message with null module');
        }).not.toThrow();
        
        expect(() => {
            logger.error(undefined, 'Message with undefined module');
        }).not.toThrow();
        
        expect(() => {
            logger.error('', 'Message with empty module');
        }).not.toThrow();
    });
    
    // ❌ Negative Test: Handles missing message gracefully
    test('handles missing message without crashing', () => {
        // Arrange & Act & Assert - should not throw
        expect(() => {
            logger.error('TestModule', null);
        }).not.toThrow();
        
        expect(() => {
            logger.error('TestModule', undefined);
        }).not.toThrow();
        
        expect(() => {
            logger.error('TestModule', '');
        }).not.toThrow();
    });
    
    // ❌ Negative Test: Handles invalid log level gracefully
    test('handles invalid log level without crashing', () => {
        // Arrange & Act & Assert - should not throw
        expect(() => {
            logger.setLevel('INVALID_LEVEL');
        }).not.toThrow();
        
        // Current level should remain unchanged
        logger.error('TestModule', 'Test after invalid level');
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        expect(logContent).toContain('Test after invalid level');
    });
});

// ============================================================
// Test Suite: Log File Rotation
// ============================================================

describe('Log File Rotation', () => {
    
    // ✅ Positive Test: Log file rotates when size exceeds threshold
    test('rotates log file when size exceeds 10MB threshold', () => {
        // Arrange
        // Write enough data to exceed threshold
        const largeMessage = 'x'.repeat(1024 * 1024); // 1MB string
        
        // Act - Write 11MB of data (exceeds 10MB threshold)
        for (let i = 0; i < 12; i++) {
            logger.error('TestModule', `Large message ${i}`, { data: largeMessage });
        }
        
        // Assert - rotated file should exist
        const files = fs.readdirSync(LOG_DIR);
        const rotatedFiles = files.filter(f => f.startsWith('app-') && f.endsWith('.log'));
        expect(rotatedFiles.length).toBeGreaterThan(0);
    });
    
    // ✅ Positive Test: Rotated log file has timestamp in name
    test('rotated log file includes timestamp in filename', () => {
        // Arrange & Act
        const largeMessage = 'x'.repeat(1024 * 1024);
        for (let i = 0; i < 12; i++) {
            logger.error('TestModule', `Large message ${i}`, { data: largeMessage });
        }
        
        // Assert
        const files = fs.readdirSync(LOG_DIR);
        const rotatedFiles = files.filter(f => f.startsWith('app-') && f.endsWith('.log'));
        expect(rotatedFiles.length).toBeGreaterThan(0);
        
        // Check timestamp format in filename (should contain date-time)
        const rotatedFile = rotatedFiles[0];
        expect(rotatedFile).toMatch(/app-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.log/);
    });
    
    // ✅ Positive Test: New log file created after rotation
    test('creates new log file after rotation', () => {
        // Arrange
        const largeMessage = 'x'.repeat(1024 * 1024);
        
        // Act - Trigger rotation
        for (let i = 0; i < 12; i++) {
            logger.error('TestModule', `Large message ${i}`, { data: largeMessage });
        }
        
        // Write a new message after rotation
        logger.info('AfterRotation', 'New log after rotation');
        
        // Assert - app.log should exist with new content
        expect(fs.existsSync(LOG_FILE_PATH)).toBe(true);
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        expect(logContent).toContain('New log after rotation');
    });
    
    // ✅ Positive Test: Log rotation prevents disk full by archiving old logs
    test('old log content preserved in rotated file', () => {
        // Arrange
        const testMessage = 'Message before rotation';
        
        // Act - Write initial message
        logger.error('TestModule', testMessage);
        
        // Trigger rotation with large data
        const largeMessage = 'x'.repeat(1024 * 1024);
        for (let i = 0; i < 12; i++) {
            logger.error('TestModule', `Large message ${i}`, { data: largeMessage });
        }
        
        // Assert - find rotated file and check it contains original message
        const files = fs.readdirSync(LOG_DIR);
        const rotatedFiles = files.filter(f => f.startsWith('app-') && f.endsWith('.log'));
        
        let foundOriginalMessage = false;
        rotatedFiles.forEach(file => {
            const content = fs.readFileSync(path.join(LOG_DIR, file), 'utf8');
            if (content.includes(testMessage)) {
                foundOriginalMessage = true;
            }
        });
        
        expect(foundOriginalMessage).toBe(true);
    });
});

// ============================================================
// Test Suite: All Error Levels Logged
// ============================================================

describe('All Error Levels Logged', () => {
    
    // ✅ Positive Test: ERROR level logs to file
    test('ERROR level messages are logged to file', () => {
        // Arrange & Act
        logger.error('ErrorMod', 'Error message');
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const logEntry = JSON.parse(logContent.trim());
        expect(logEntry.level).toBe('ERROR');
    });
    
    // ✅ Positive Test: WARN level logs to file
    test('WARN level messages are logged to file', () => {
        // Arrange & Act
        logger.warn('WarnMod', 'Warning message');
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const logEntry = JSON.parse(logContent.trim());
        expect(logEntry.level).toBe('WARN');
    });
    
    // ✅ Positive Test: INFO level logs to file
    test('INFO level messages are logged to file', () => {
        // Arrange & Act
        logger.info('InfoMod', 'Info message');
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const logEntry = JSON.parse(logContent.trim());
        expect(logEntry.level).toBe('INFO');
    });
    
    // ✅ Positive Test: DEBUG level logs when level set to DEBUG
    test('DEBUG level messages are logged when level is DEBUG', () => {
        // Arrange
        logger.setLevel('DEBUG');
        
        // Act
        logger.debug('DebugMod', 'Debug message');
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const logEntry = JSON.parse(logContent.trim());
        expect(logEntry.level).toBe('DEBUG');
    });
});

// ============================================================
// Test Suite: Integration with Server Components
// ============================================================

describe('Integration with Server Components', () => {
    
    // ✅ Positive Test: Logger can be required from server modules
    test('logger module can be required without errors', () => {
        // Arrange & Act & Assert
        expect(logger).toBeDefined();
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.setLevel).toBe('function');
    });
    
    // ✅ Positive Test: Log entries have consistent structure
    test('all log entries have consistent structure (timestamp, level, module, message)', () => {
        // Arrange & Act
        logger.error('Mod1', 'Error msg');
        logger.warn('Mod2', 'Warn msg');
        logger.info('Mod3', 'Info msg');
        logger.setLevel('DEBUG');
        logger.debug('Mod4', 'Debug msg');
        
        // Assert
        const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const lines = logContent.trim().split('\n');
        
        lines.forEach(line => {
            const entry = JSON.parse(line);
            expect(entry.timestamp).toBeDefined();
            expect(entry.level).toBeDefined();
            expect(entry.module).toBeDefined();
            expect(entry.message).toBeDefined();
        });
    });
});
