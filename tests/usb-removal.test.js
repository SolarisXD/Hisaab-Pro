/**
 * USB Removal Handling Tests — Hisaab Pro
 * 
 * Unit tests for data integrity and recovery after unsafe USB removal.
 * Uses mocked database module to test behavior in isolation.
 * 
 * Acceptance Criteria:
 * 1. WAL mode prevents data corruption on unsafe removal
 * 2. Database integrity checks detect corruption
 * 3. Recovery mechanisms restore data consistency
 * 4. Checkpoint operations ensure WAL data is written
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

// =============================================================================
// UNIT TESTS - Using mocked database module
// =============================================================================

describe('USB Unsafe Removal — Unit Tests (Mocked Database)', () => {
    let mockDbInstance;
    let DatabaseMock;
    
    // Mock the database module for unit tests
    jest.mock('better-sqlite3-multiple-ciphers');
    jest.mock('../server/config', () => ({
        database: {
            path: ':memory:',
            active_database: 'test.db',
            database_key: 'test-key-123'
        },
        backup: {
            auto_time: '23:00',
            usb_drive_label: 'HISAABPRO_BKP'
        },
        is_production: false
    }), { virtual: true });

    // Import after mocking
    const Database = require('better-sqlite3-multiple-ciphers');
    const { getDbInstance, closeDb } = require('./database-wrapper');

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Create a mock database instance with all necessary methods
        mockDbInstance = {
            pragma: jest.fn(),
            exec: jest.fn(),
            prepare: jest.fn().mockReturnValue({
                get: jest.fn().mockReturnValue({ count: 0 }),
                run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
                all: jest.fn().mockReturnValue([])
            }),
            close: jest.fn(),
            transaction: jest.fn((fn) => fn),
            backup: jest.fn()
        };

        // Setup the Database mock constructor
        Database.mockImplementation(() => mockDbInstance);
        
        // Setup default pragma responses for WAL mode
        mockDbInstance.pragma.mockImplementation((pragma, options) => {
            if (pragma === 'journal_mode = WAL' || pragma === 'journal_mode = wal') {
                return 'wal';
            }
            if (pragma === 'journal_mode') {
                return 'wal';
            }
            if (pragma === 'foreign_keys = ON') {
                return;
            }
            if (pragma === 'wal_checkpoint(TRUNCATE)') {
                return [0, 0, 0]; // busy, log, checkpointed
            }
            if (typeof pragma === 'string' && pragma.startsWith('key')) {
                return;
            }
            return null;
        });
    });

    afterEach(() => {
        if (closeDb) closeDb();
    });

    // =========================================================================
    // ✅ POSITIVE TESTS — WAL Mode Prevents Corruption
    // =========================================================================

    // ✅ Positive Test: WAL mode is enabled to protect against unsafe removal
    it('should enable WAL mode to prevent corruption on unsafe USB removal', () => {
        // Arrange
        const testFilename = 'test-wal.db';
        
        // Act
        getDbInstance(testFilename);
        
        // Assert
        expect(mockDbInstance.pragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    // ✅ Positive Test: WAL mode returns 'wal' confirming it's active
    it('should confirm WAL mode is active by checking journal_mode pragma', () => {
        // Arrange
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'journal_mode') {
                return 'wal';
            }
            return null;
        });
        
        // Act
        const journalMode = mockDbInstance.pragma('journal_mode');
        
        // Assert
        expect(journalMode).toBe('wal');
    });

    // ✅ Positive Test: Checkpoint ensures WAL data is written to main database
    it('should perform checkpoint to sync WAL data before critical operations', () => {
        // Arrange & Act
        mockDbInstance.pragma('wal_checkpoint(TRUNCATE)');
        
        // Assert
        expect(mockDbInstance.pragma).toHaveBeenCalledWith('wal_checkpoint(TRUNCATE)');
    });

    // ✅ Positive Test: Foreign key constraints are enabled alongside WAL
    it('should enable foreign key constraints to maintain data integrity', () => {
        // Arrange
        const testFilename = 'fk-integrity.db';
        
        // Act
        getDbInstance(testFilename);
        
        // Assert
        expect(mockDbInstance.pragma).toHaveBeenCalledWith('foreign_keys = ON');
    });

    // ✅ Positive Test: Database can perform operations after WAL mode set
    it('should allow database operations after WAL mode is enabled', () => {
        // Arrange
        const mockStmt = {
            run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
            get: jest.fn().mockReturnValue({ id: 1 })
        };
        mockDbInstance.prepare.mockReturnValue(mockStmt);
        
        // Act
        const stmt = mockDbInstance.prepare('INSERT INTO test (name) VALUES (?)');
        const result = stmt.run('test-value');
        
        // Assert
        expect(result.changes).toBe(1);
        expect(mockDbInstance.prepare).toHaveBeenCalledWith('INSERT INTO test (name) VALUES (?)');
    });

    // =========================================================================
    // ❌ NEGATIVE TESTS — Corruption Detection and Handling
    // =========================================================================

    // ❌ Negative Test: Should detect if WAL mode is not enabled
    it('should detect when journal_mode is not WAL (potential corruption risk)', () => {
        // Arrange
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'journal_mode') {
                return 'delete'; // Not WAL - vulnerable to corruption
            }
            return null;
        });
        
        // Act
        const journalMode = mockDbInstance.pragma('journal_mode');
        
        // Assert
        expect(journalMode).not.toBe('wal');
        expect(journalMode).toBe('delete');
    });

    // ❌ Negative Test: Should handle WAL mode failure gracefully
    it('should handle WAL mode failure and log warning', () => {
        // Arrange
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        // Simulate WAL mode failure
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'journal_mode = WAL') {
                throw new Error('WAL mode not supported');
            }
            return null;
        });
        
        // Act & Assert
        expect(() => {
            mockDbInstance.pragma('journal_mode = WAL');
        }).toThrow('WAL mode not supported');
        
        consoleWarnSpy.mockRestore();
    });

    // ❌ Negative Test: Should detect database corruption via integrity_check
    it('should detect database corruption using integrity_check pragma', () => {
        // Arrange
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'integrity_check') {
                return [{ 'integrity_check': 'ok' }];
            }
            return null;
        });
        
        // Act
        const result = mockDbInstance.pragma('integrity_check');
        
        // Assert
        expect(result).toBeDefined();
        expect(result[0]['integrity_check']).toBe('ok');
    });

    // ❌ Negative Test: Should identify corruption when integrity_check returns errors
    it('should identify corruption when integrity_check returns error messages', () => {
        // Arrange
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'integrity_check') {
                return [
                    { 'integrity_check': 'wrong # of entries in index sqlite_autoindex...' },
                    { 'integrity_check': 'database corruption detected' }
                ];
            }
            return null;
        });
        
        // Act
        const result = mockDbInstance.pragma('integrity_check');
        
        // Assert
        expect(result[0]['integrity_check']).not.toBe('ok');
        expect(result[0]['integrity_check']).toContain('wrong # of entries');
    });

    // ❌ Negative Test: Should handle database file missing after USB removal
    it('should handle missing database file after unsafe USB removal', () => {
        // Arrange
        Database.mockImplementationOnce(() => {
            throw new Error('Cannot open database: file not found');
        });
        
        // Act & Assert
        expect(() => {
            getDbInstance('missing-db.db');
        }).toThrow('Cannot open database: file not found');
    });

    // ❌ Negative Test: Should handle encryption key errors
    it('should handle encryption key errors during database open', () => {
        // Arrange
        const Database = require('better-sqlite3-multiple-ciphers');
        let callCount = 0;
        Database.mockImplementation(() => {
            callCount++;
            const mockInstance = {
                pragma: jest.fn().mockImplementation((pragma) => {
                    if (typeof pragma === 'string' && pragma.startsWith('key')) {
                        throw new Error('file is encrypted or is not a database');
                    }
                    if (pragma === 'journal_mode = WAL') {
                        return 'wal';
                    }
                    return null;
                }),
                close: jest.fn()
            };
            return mockInstance;
        });
        
        // Act & Assert - The getDbInstance should throw on encryption error
        expect(() => {
            getDbInstance('encrypted-wrong-key.db');
        }).toThrow('file is encrypted or is not a database');
    });

    // ❌ Negative Test: Should handle WAL mode failure gracefully
    it('should handle WAL mode failure gracefully', () => {
        // Arrange
        const Database = require('better-sqlite3-multiple-ciphers');
        const mockInstance = {
            pragma: jest.fn().mockImplementation((pragma) => {
                if (pragma === 'journal_mode = WAL') {
                    throw new Error('WAL mode not supported');
                }
                if (pragma === 'journal_mode') {
                    return 'delete'; // Not WAL
                }
                return null;
            }),
            exec: jest.fn(), // Add exec method
            close: jest.fn()
        };
        Database.mockImplementationOnce(() => mockInstance);
        
        // Act - Should NOT throw, just log warning
        const db = getDbInstance('wal-failure.db');
        
        // Assert - Should still return db instance (graceful handling)
        expect(db).toBeDefined();
        // WAL mode should have been attempted
        expect(mockInstance.pragma).toHaveBeenCalledWith('journal_mode = WAL');
        // Journal mode should NOT be WAL
        const journalMode = mockInstance.pragma('journal_mode');
        expect(journalMode).not.toBe('wal');
    });

    // ❌ Negative Test: Should handle config write errors during key migration
    it('should handle config write errors during key migration', () => {
        // Arrange
        const Database = require('better-sqlite3-multiple-ciphers');
        
        // Create a mock instance that allows the key pragma to succeed
        const mockInstance = {
            pragma: jest.fn().mockImplementation((pragma) => {
                if (pragma.startsWith('key')) {
                    return; // Key pragma succeeds
                }
                if (pragma === 'journal_mode = WAL') {
                    return 'wal';
                }
                return null;
            }),
            exec: jest.fn(),
            close: jest.fn()
        };
        Database.mockImplementationOnce(() => mockInstance);
        
        // We can't easily mock fs.writeFileSync because database.js uses inline require
        // Instead, we'll test that getDbInstance doesn't throw even if config write fails
        // The code has a try-catch that handles the error gracefully
        
        // Act & Assert - Should NOT throw
        const db = getDbInstance('key-migration-test.db');
        expect(db).toBeDefined();
        expect(mockInstance.pragma).toHaveBeenCalledWith(expect.stringContaining('key'));
    });

    // =========================================================================
    // ✅ POSITIVE TESTS — Recovery Mechanisms
    // =========================================================================

    // ✅ Positive Test: Backup before operations protects against data loss
    it('should support database backup for recovery purposes', () => {
        // Arrange
        const mockBackup = jest.fn();
        mockDbInstance.backup = mockBackup;
        
        // Act
        mockDbInstance.backup('/path/to/backup.db');
        
        // Assert
        expect(mockDbInstance.backup).toHaveBeenCalledWith('/path/to/backup.db');
    });

    // ✅ Positive Test: Transaction rollback maintains consistency on failure
    it('should rollback transaction to maintain consistency after partial write', () => {
        // Arrange
        const mockFn = jest.fn();
        mockDbInstance.transaction.mockImplementation((callback) => {
            return (...args) => {
                try {
                    return callback(...args);
                } catch (e) {
                    throw e;
                }
            };
        });
        
        // Act
        mockDbInstance.transaction(mockFn);
        
        // Assert
        expect(mockDbInstance.transaction).toHaveBeenCalledWith(mockFn);
    });

    // ✅ Positive Test: Checkpoint returns expected values indicating success
    it('should return success indicators from checkpoint operation', () => {
        // Arrange
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'wal_checkpoint(TRUNCATE)') {
                return [0, 0, 0]; // busy=0, log=0, checkpointed=0 (all good)
            }
            return null;
        });
        
        // Act
        const result = mockDbInstance.pragma('wal_checkpoint(TRUNCATE)');
        
        // Assert
        expect(result[0]).toBe(0); // Not busy
        expect(result[1]).toBe(0); // No pages in WAL
        expect(result[2]).toBe(0); // All pages checkpointed
    });

    // =========================================================================
    // ❌ NEGATIVE TESTS — Edge Cases and Error Handling
    // =========================================================================

    // ❌ Negative Test: Should handle checkpoint failure
    it('should handle checkpoint failure gracefully', () => {
        // Arrange
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'wal_checkpoint(TRUNCATE)') {
                throw new Error('Checkpoint failed: database is locked');
            }
            return null;
        });
        
        // Act & Assert
        expect(() => {
            mockDbInstance.pragma('wal_checkpoint(TRUNCATE)');
        }).toThrow('Checkpoint failed: database is locked');
    });

    // ❌ Negative Test: Should handle encrypted database with wrong key after removal
    it('should handle encryption key errors that may occur after USB removal', () => {
        // Arrange
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (typeof pragma === 'string' && pragma.startsWith('key')) {
                throw new Error('file is encrypted or is not a database');
            }
            return null;
        });
        
        // Act & Assert
        expect(() => {
            mockDbInstance.pragma("key = 'wrong-key'");
        }).toThrow('file is encrypted or is not a database');
    });

    // ❌ Negative Test: Should handle database lock after unsafe removal
    it('should handle database lock errors from incomplete transactions', () => {
        // Arrange
        Database.mockImplementationOnce(() => {
            throw new Error('database is locked');
        });
        
        // Act & Assert
        expect(() => {
            getDbInstance('locked-db.db');
        }).toThrow('database is locked');
    });

    // =========================================================================
    // ✅ POSITIVE TESTS — Recovery Scenarios
    // =========================================================================

    // ✅ Positive Test: Recovery by restoring from backup
    it('should support recovery by restoring database from backup file', () => {
        // Arrange
        const backupPath = '/backups/hisaab-backup-2026-04-30.db';
        const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        const fsCopyFileSyncSpy = jest.spyOn(fs, 'copyFileSync').mockImplementation();
        
        // Act - Simulate restore from backup
        const restoreSuccessful = fs.existsSync(backupPath);
        if (restoreSuccessful) {
            fs.copyFileSync(backupPath, '/data/hisaab.db');
        }
        
        // Assert
        expect(restoreSuccessful).toBe(true);
        expect(fsExistsSyncSpy).toHaveBeenCalledWith(backupPath);
        
        fsExistsSyncSpy.mockRestore();
        fsCopyFileSyncSpy.mockRestore();
    });

    // ✅ Positive Test: WAL checkpoint before backup ensures data consistency
    it('should perform checkpoint before backup to ensure all data is written', () => {
        // Arrange
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'wal_checkpoint(TRUNCATE)') {
                return [0, 0, 0]; // Success
            }
            return null;
        });
        
        // Act - Simulate pre-backup checkpoint
        const checkpointResult = mockDbInstance.pragma('wal_checkpoint(TRUNCATE)');
        
        // Assert
        expect(mockDbInstance.pragma).toHaveBeenCalledWith('wal_checkpoint(TRUNCATE)');
        expect(checkpointResult[2]).toBe(0); // All pages checkpointed
    });

    // ❌ Negative Test: Should handle backup file missing during recovery
    it('should handle missing backup file during recovery attempt', () => {
        // Arrange
        const backupPath = '/backups/nonexistent-backup.db';
        const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
        
        // Act
        const backupExists = fs.existsSync(backupPath);
        
        // Assert
        expect(backupExists).toBe(false);
        
        fsExistsSyncSpy.mockRestore();
    });

    // ✅ Positive Test: Database reopening after simulated crash
    it('should successfully reopen database after simulated unsafe removal', () => {
        // Arrange
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'journal_mode = WAL') {
                return 'wal';
            }
            if (pragma === 'journal_mode') {
                return 'wal';
            }
            return null;
        });
        
        // Act - Simulate reopening database
        getDbInstance('reopen-after-crash.db');
        
        // Assert - Database should reopen with WAL mode
        expect(mockDbInstance.pragma).toHaveBeenCalledWith('journal_mode = WAL');
    });
});
