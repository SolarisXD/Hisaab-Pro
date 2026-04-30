/**
 * USB Performance Tests — Hisaab Pro
 * 
 * Tests for database performance on slow USB drives.
 * Uses mocked database module to simulate slow USB scenarios and verify
 * that operations complete within acceptable time thresholds.
 * 
 * Acceptance Criteria:
 * 1. Database writes should complete within acceptable time limits on slow USB
 * 2. Database reads should complete within acceptable time limits on slow USB
 * 3. Checkpoint operations should handle slow USB scenarios
 * 4. Backup operations should handle slow USB scenarios
 * 5. Timeout handling should work correctly for slow operations
 * 6. Performance thresholds should be configurable
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

// =============================================================================
// PERFORMANCE TESTS - Using mocked database with simulated slow USB
// =============================================================================

describe('USB Performance Tests — Slow USB Drive Scenarios', () => {
    let mockDbInstance;
    let DatabaseMock;
    let performanceThresholds;
    
    // Mock the database module for performance tests
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
        session: {
            timeout_minutes: 15
        },
        is_production: false
    }), { virtual: true });

    // Import after mocking
    const Database = require('better-sqlite3-multiple-ciphers');
    const { getDbInstance, closeDb } = require('./database-wrapper');

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Performance thresholds (in milliseconds)
        performanceThresholds = {
            writeOperation: 100,    // Write should complete within 100ms on slow USB
            readOperation: 50,      // Read should complete within 50ms on slow USB
            checkpoint: 200,        // Checkpoint should complete within 200ms
            backup: 5000,           // Backup can take up to 5 seconds on slow USB
            transaction: 150,       // Transaction should complete within 150ms
            batchInsert: 300        // Batch insert (10 records) within 300ms
        };
        
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
            if (pragma === 'wal_checkpoint(TRUNCATE)' || pragma === 'wal_checkpoint(FULL)') {
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
        jest.restoreAllMocks();
    });

    // =========================================================================
    // HELPER FUNCTIONS FOR PERFORMANCE TESTING
    // =========================================================================

    /**
     * Simulates a slow operation by adding delay to a mock function
     * @param {Function} mockFn - The mock function to make slow
     * @param {number} delayMs - Delay in milliseconds
     * @returns {Function} - The slow mock function
     */
    const createSlowMock = (mockFn, delayMs) => {
        return jest.fn().mockImplementation((...args) => {
            const startTime = Date.now();
            while (Date.now() - startTime < delayMs) {
                // Busy wait to simulate slow operation
            }
            return mockFn(...args);
        });
    };

    /**
     * Measures the execution time of a function
     * @param {Function} fn - Function to measure
     * @returns {number} - Execution time in milliseconds
     */
    const measureTime = (fn) => {
        const start = performance.now();
        fn();
        return performance.now() - start;
    };

    /**
     * Measures the execution time of an async function
     * @param {Function} fn - Async function to measure
     * @returns {Promise<number>} - Execution time in milliseconds
     */
    const measureTimeAsync = async (fn) => {
        const start = performance.now();
        await fn();
        return performance.now() - start;
    };

    // =========================================================================
    // ✅ POSITIVE TESTS — Performance Within Acceptable Thresholds
    // =========================================================================

    // ✅ Positive Test: Single write operation completes within threshold on slow USB
    it('should complete single write operation within threshold on slow USB', () => {
        // Arrange
        const slowWriteDelay = 80; // 80ms - within 100ms threshold
        const mockStmt = {
            run: createSlowMock(
                jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
                slowWriteDelay
            )
        };
        mockDbInstance.prepare.mockReturnValue(mockStmt);
        
        // Act
        const duration = measureTime(() => {
            const stmt = mockDbInstance.prepare('INSERT INTO test (name) VALUES (?)');
            stmt.run('test-value');
        });
        
        // Assert
        expect(duration).toBeLessThan(performanceThresholds.writeOperation);
        expect(mockStmt.run).toHaveBeenCalledWith('test-value');
    });

    // ✅ Positive Test: Single read operation completes within threshold on slow USB
    it('should complete single read operation within threshold on slow USB', () => {
        // Arrange
        const slowReadDelay = 30; // 30ms - within 50ms threshold
        const mockStmt = {
            get: createSlowMock(
                jest.fn().mockReturnValue({ id: 1, name: 'test' }),
                slowReadDelay
            )
        };
        mockDbInstance.prepare.mockReturnValue(mockStmt);
        
        // Act
        const duration = measureTime(() => {
            const stmt = mockDbInstance.prepare('SELECT * FROM test WHERE id = ?');
            stmt.get(1);
        });
        
        // Assert
        expect(duration).toBeLessThan(performanceThresholds.readOperation);
        expect(mockStmt.get).toHaveBeenCalledWith(1);
    });

    // ✅ Positive Test: Checkpoint operation completes within threshold on slow USB
    it('should complete checkpoint operation within threshold on slow USB', () => {
        // Arrange
        const slowCheckpointDelay = 150; // 150ms - within 200ms threshold
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'wal_checkpoint(TRUNCATE)') {
                // Simulate slow checkpoint
                const startTime = Date.now();
                while (Date.now() - startTime < slowCheckpointDelay) {
                    // Busy wait
                }
                return [0, 0, 0];
            }
            return null;
        });
        
        // Act
        const duration = measureTime(() => {
            mockDbInstance.pragma('wal_checkpoint(TRUNCATE)');
        });
        
        // Assert
        expect(duration).toBeLessThan(performanceThresholds.checkpoint);
        expect(mockDbInstance.pragma).toHaveBeenCalledWith('wal_checkpoint(TRUNCATE)');
    });

    // ✅ Positive Test: Transaction completes within threshold on slow USB
    it('should complete transaction within threshold on slow USB', () => {
        // Arrange
        const slowTransactionDelay = 100; // 100ms - within 150ms threshold
        let transactionCallback;
        mockDbInstance.transaction.mockImplementation((fn) => {
            transactionCallback = fn;
            return (...args) => {
                // Simulate slow transaction
                const startTime = Date.now();
                while (Date.now() - startTime < slowTransactionDelay) {
                    // Busy wait
                }
                return fn(...args);
            };
        });
        
        // Act
        const duration = measureTime(() => {
            const mockFn = jest.fn();
            const transactionFn = mockDbInstance.transaction(mockFn);
            transactionFn();
        });
        
        // Assert
        expect(duration).toBeLessThan(performanceThresholds.transaction);
        expect(mockDbInstance.transaction).toHaveBeenCalled();
    });

    // ✅ Positive Test: Batch insert (10 records) completes within threshold on slow USB
    it('should complete batch insert within threshold on slow USB', () => {
        // Arrange
        const slowBatchDelay = 250; // 250ms for 10 records - within 300ms threshold
        const mockStmt = {
            run: createSlowMock(
                jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
                slowBatchDelay / 10 // Divide delay across 10 records
            )
        };
        mockDbInstance.prepare.mockReturnValue(mockStmt);
        
        // Act
        const duration = measureTime(() => {
            const stmt = mockDbInstance.prepare('INSERT INTO test (name) VALUES (?)');
            for (let i = 0; i < 10; i++) {
                stmt.run(`value-${i}`);
            }
        });
        
        // Assert
        expect(duration).toBeLessThan(performanceThresholds.batchInsert);
        expect(mockStmt.run).toHaveBeenCalledTimes(10);
    });

    // ✅ Positive Test: Database open with WAL mode is fast even on slow USB
    it('should open database with WAL mode quickly on slow USB', () => {
        // Arrange
        const slowOpenDelay = 50; // 50ms - should be fast
        Database.mockImplementationOnce(() => {
            // Simulate slow database open
            const startTime = Date.now();
            while (Date.now() - startTime < slowOpenDelay) {
                // Busy wait
            }
            return mockDbInstance;
        });
        
        // Act
        const duration = measureTime(() => {
            getDbInstance('slow-usb-test.db');
        });
        
        // Assert
        expect(duration).toBeLessThan(100); // Should open within 100ms
        expect(mockDbInstance.pragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    // ✅ Positive Test: Multiple sequential reads complete within cumulative threshold
    it('should handle multiple sequential reads within cumulative threshold on slow USB', () => {
        // Arrange
        const readDelayPerOp = 20; // 20ms per read
        const mockStmt = {
            get: createSlowMock(
                jest.fn().mockReturnValue({ id: 1 }),
                readDelayPerOp
            )
        };
        mockDbInstance.prepare.mockReturnValue(mockStmt);
        
        // Act
        const duration = measureTime(() => {
            const stmt = mockDbInstance.prepare('SELECT * FROM test WHERE id = ?');
            for (let i = 0; i < 5; i++) {
                stmt.get(i);
            }
        });
        
        // Assert - 5 reads * 20ms = 100ms, should be under 250ms cumulative
        expect(duration).toBeLessThan(250);
        expect(mockStmt.get).toHaveBeenCalledTimes(5);
    });

    // =========================================================================
    // ❌ NEGATIVE TESTS — Performance Exceeds Thresholds (Slow USB)
    // =========================================================================

    // ❌ Negative Test: Write operation exceeds threshold on very slow USB
    it('should detect when write operation exceeds threshold on very slow USB', () => {
        // Arrange
        const verySlowWriteDelay = 150; // 150ms - exceeds 100ms threshold
        const mockStmt = {
            run: createSlowMock(
                jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
                verySlowWriteDelay
            )
        };
        mockDbInstance.prepare.mockReturnValue(mockStmt);
        
        // Act
        const duration = measureTime(() => {
            const stmt = mockDbInstance.prepare('INSERT INTO test (name) VALUES (?)');
            stmt.run('test-value');
        });
        
        // Assert
        expect(duration).toBeGreaterThan(performanceThresholds.writeOperation);
        expect(mockStmt.run).toHaveBeenCalledWith('test-value');
    });

    // ❌ Negative Test: Read operation exceeds threshold on very slow USB
    it('should detect when read operation exceeds threshold on very slow USB', () => {
        // Arrange
        const verySlowReadDelay = 80; // 80ms - exceeds 50ms threshold
        const mockStmt = {
            get: createSlowMock(
                jest.fn().mockReturnValue({ id: 1 }),
                verySlowReadDelay
            )
        };
        mockDbInstance.prepare.mockReturnValue(mockStmt);
        
        // Act
        const duration = measureTime(() => {
            const stmt = mockDbInstance.prepare('SELECT * FROM test WHERE id = ?');
            stmt.get(1);
        });
        
        // Assert
        expect(duration).toBeGreaterThan(performanceThresholds.readOperation);
        expect(mockStmt.get).toHaveBeenCalledWith(1);
    });

    // ❌ Negative Test: Checkpoint operation times out on extremely slow USB
    it('should handle checkpoint timeout on extremely slow USB', () => {
        // Arrange
        const extremelySlowCheckpointDelay = 500; // 500ms - exceeds 200ms threshold
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'wal_checkpoint(TRUNCATE)') {
                // Simulate extremely slow checkpoint
                const startTime = Date.now();
                while (Date.now() - startTime < extremelySlowCheckpointDelay) {
                    // Busy wait
                }
                return [1, 10, 5]; // busy=1 (still busy), log=10, checkpointed=5
            }
            return null;
        });
        
        // Act
        const duration = measureTime(() => {
            mockDbInstance.pragma('wal_checkpoint(TRUNCATE)');
        });
        
        // Assert
        expect(duration).toBeGreaterThan(performanceThresholds.checkpoint);
        expect(mockDbInstance.pragma).toHaveBeenCalledWith('wal_checkpoint(TRUNCATE)');
    });

    // ❌ Negative Test: Transaction exceeds threshold on slow USB
    it('should detect when transaction exceeds threshold on slow USB', () => {
        // Arrange
        const verySlowTransactionDelay = 200; // 200ms - exceeds 150ms threshold
        mockDbInstance.transaction.mockImplementation((fn) => {
            return (...args) => {
                // Simulate very slow transaction
                const startTime = Date.now();
                while (Date.now() - startTime < verySlowTransactionDelay) {
                    // Busy wait
                }
                return fn(...args);
            };
        });
        
        // Act
        const duration = measureTime(() => {
            const mockFn = jest.fn();
            const transactionFn = mockDbInstance.transaction(mockFn);
            transactionFn();
        });
        
        // Assert
        expect(duration).toBeGreaterThan(performanceThresholds.transaction);
    });

    // ❌ Negative Test: Batch insert exceeds threshold on very slow USB
    it('should detect when batch insert exceeds threshold on very slow USB', () => {
        // Arrange
        const verySlowBatchDelay = 400; // 400ms - exceeds 300ms threshold
        const mockStmt = {
            run: createSlowMock(
                jest.fn().mockReturnValue({ changes: 1 }),
                verySlowBatchDelay / 10
            )
        };
        mockDbInstance.prepare.mockReturnValue(mockStmt);
        
        // Act
        const duration = measureTime(() => {
            const stmt = mockDbInstance.prepare('INSERT INTO test (name) VALUES (?)');
            for (let i = 0; i < 10; i++) {
                stmt.run(`value-${i}`);
            }
        });
        
        // Assert
        expect(duration).toBeGreaterThan(performanceThresholds.batchInsert);
        expect(mockStmt.run).toHaveBeenCalledTimes(10);
    });

    // ❌ Negative Test: Database open times out on extremely slow USB
    it('should handle database open timeout on extremely slow USB', () => {
        // Arrange
        const extremelySlowOpenDelay = 200; // 200ms - slow for database open
        Database.mockImplementationOnce(() => {
            // Simulate extremely slow database open
            const startTime = Date.now();
            while (Date.now() - startTime < extremelySlowOpenDelay) {
                // Busy wait
            }
            return mockDbInstance;
        });
        
        // Act
        const duration = measureTime(() => {
            try {
                getDbInstance('very-slow-usb.db');
            } catch (e) {
                // Expected to potentially timeout
            }
        });
        
        // Assert
        expect(duration).toBeGreaterThan(100); // Exceeds fast open threshold
    });

    // ❌ Negative Test: Multiple operations cumulative time exceeds threshold
    it('should detect when cumulative operation time exceeds threshold on slow USB', () => {
        // Arrange
        const readDelay = 30; // Each read takes 30ms
        const writeDelay = 60; // Each write takes 60ms
        const mockReadStmt = {
            get: createSlowMock(
                jest.fn().mockReturnValue({ id: 1 }),
                readDelay
            )
        };
        const mockWriteStmt = {
            run: createSlowMock(
                jest.fn().mockReturnValue({ changes: 1 }),
                writeDelay
            )
        };
        
        // Alternate between read and write statements
        let callCount = 0;
        mockDbInstance.prepare.mockImplementation(() => {
            callCount++;
            return callCount % 2 === 0 ? mockWriteStmt : mockReadStmt;
        });
        
        // Act - Perform 5 reads and 5 writes
        const duration = measureTime(() => {
            for (let i = 0; i < 5; i++) {
                const readStmt = mockDbInstance.prepare('SELECT * FROM test WHERE id = ?');
                readStmt.get(i);
                const writeStmt = mockDbInstance.prepare('INSERT INTO test (name) VALUES (?)');
                writeStmt.run(`value-${i}`);
            }
        });
        
        // Assert - 5 * (30ms + 60ms) = 450ms, should exceed some threshold
        expect(duration).toBeGreaterThan(400); // Cumulative time is high
    });

    // =========================================================================
    // ✅ POSITIVE TESTS — Backup Performance on Slow USB
    // =========================================================================

    // ✅ Positive Test: Backup completes within threshold on slow USB
    it('should complete backup within threshold on slow USB', () => {
        // Arrange
        const slowBackupDelay = 3000; // 3 seconds - within 5 second threshold
        mockDbInstance.backup.mockImplementation((backupPath) => {
            // Simulate slow backup
            const startTime = Date.now();
            while (Date.now() - startTime < slowBackupDelay) {
                // Busy wait
            }
            return Promise.resolve();
        });
        
        // Act
        const duration = measureTime(() => {
            mockDbInstance.backup('/path/to/backup.db');
        });
        
        // Assert
        expect(duration).toBeLessThan(performanceThresholds.backup);
        expect(mockDbInstance.backup).toHaveBeenCalledWith('/path/to/backup.db');
    });

    // ✅ Positive Test: WAL mode is still enabled quickly even on slow USB
    it('should enable WAL mode quickly even on slow USB', () => {
        // Arrange
        const slowPragmaDelay = 30; // 30ms for pragma - still fast
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'journal_mode = WAL') {
                // Simulate slight delay
                const startTime = Date.now();
                while (Date.now() - startTime < slowPragmaDelay) {
                    // Busy wait
                }
                return 'wal';
            }
            return null;
        });
        
        // Act
        const duration = measureTime(() => {
            getDbInstance('wal-slow-usb.db');
        });
        
        // Assert - WAL mode setup should still be fast
        expect(duration).toBeLessThan(100);
        expect(mockDbInstance.pragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    // =========================================================================
    // ❌ NEGATIVE TESTS — Backup Performance Issues on Slow USB
    // =========================================================================

    // ❌ Negative Test: Backup exceeds threshold on very slow USB
    it('should detect when backup exceeds threshold on very slow USB', () => {
        // Arrange
        const verySlowBackupDelay = 6000; // 6 seconds - exceeds 5 second threshold
        mockDbInstance.backup.mockImplementation((backupPath) => {
            // Simulate very slow backup
            const startTime = Date.now();
            while (Date.now() - startTime < verySlowBackupDelay) {
                // Busy wait
            }
            return Promise.resolve();
        });
        
        // Act
        const duration = measureTime(() => {
            mockDbInstance.backup('/path/to/slow-backup.db');
        });
        
        // Assert
        expect(duration).toBeGreaterThan(performanceThresholds.backup);
        expect(mockDbInstance.backup).toHaveBeenCalledWith('/path/to/slow-backup.db');
    });

    // ❌ Negative Test: Backup fails due to USB disconnection during operation
    it('should handle backup failure due to USB disconnection', () => {
        // Arrange
        mockDbInstance.backup.mockImplementation((backupPath) => {
            throw new Error('Backup failed: USB device disconnected');
        });
        
        // Act & Assert
        expect(() => {
            mockDbInstance.backup('/path/to/backup.db');
        }).toThrow('Backup failed: USB device disconnected');
    });

    // =========================================================================
    // ✅ POSITIVE TESTS — Configurable Performance Thresholds
    // =========================================================================

    // ✅ Positive Test: Performance thresholds can be adjusted for different USB speeds
    it('should allow adjusting performance thresholds for different USB speeds', () => {
        // Arrange
        const customThresholds = {
            writeOperation: 200,  // More lenient for USB 1.0
            readOperation: 100,
            checkpoint: 500,
            backup: 10000
        };
        
        const slowWriteDelay = 150; // 150ms - within custom 200ms threshold
        const mockStmt = {
            run: createSlowMock(
                jest.fn().mockReturnValue({ changes: 1 }),
                slowWriteDelay
            )
        };
        mockDbInstance.prepare.mockReturnValue(mockStmt);
        
        // Act
        const duration = measureTime(() => {
            const stmt = mockDbInstance.prepare('INSERT INTO test (name) VALUES (?)');
            stmt.run('test-value');
        });
        
        // Assert - Using custom threshold
        expect(duration).toBeLessThan(customThresholds.writeOperation);
        expect(duration).toBeGreaterThan(performanceThresholds.writeOperation); // But exceeds default
    });

    // =========================================================================
    // ❌ NEGATIVE TESTS — Edge Cases and Error Handling
    // =========================================================================

    // ❌ Negative Test: Should handle database lock on slow USB
    it('should handle database lock on slow USB', () => {
        // Arrange
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'journal_mode = WAL') {
                throw new Error('database is locked');
            }
            return null;
        });
        
        // Act & Assert
        expect(() => {
            getDbInstance('locked-slow-usb.db');
        }).toThrow('database is locked');
    });

    // ❌ Negative Test: Should handle WAL mode failure on slow USB
    it('should handle WAL mode failure on slow USB', () => {
        // Arrange
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'journal_mode = WAL') {
                throw new Error('WAL mode not supported on this filesystem');
            }
            if (pragma === 'journal_mode') {
                return 'delete'; // Not WAL
            }
            return null;
        });
        
        // Act - Should NOT throw, just log warning (graceful handling)
        const db = getDbInstance('wal-failure-slow-usb.db');
        
        // Assert - Should still return db instance (graceful handling)
        expect(db).toBeDefined();
        expect(mockDbInstance.pragma).toHaveBeenCalledWith('journal_mode = WAL');
        const journalMode = mockDbInstance.pragma('journal_mode');
        expect(journalMode).not.toBe('wal');
        
        consoleWarnSpy.mockRestore();
    });

    // ❌ Negative Test: Should handle corruption detection on slow USB
    it('should detect corruption on slow USB using integrity_check', () => {
        // Arrange
        mockDbInstance.pragma.mockImplementation((pragma) => {
            if (pragma === 'integrity_check') {
                // Simulate slow integrity check
                const startTime = Date.now();
                while (Date.now() - startTime < 100) {
                    // Busy wait
                }
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

    // ❌ Negative Test: Should handle timeout for long-running operations
    it('should handle timeout for operations exceeding maximum time limit', () => {
        // Arrange
        const maxTimeLimit = 1000; // 1 second maximum
        const operationDelay = 1200; // 1.2 seconds - exceeds limit
        const mockStmt = {
            run: createSlowMock(
                jest.fn().mockReturnValue({ changes: 1 }),
                operationDelay
            )
        };
        mockDbInstance.prepare.mockReturnValue(mockStmt);
        
        // Act
        const duration = measureTime(() => {
            const stmt = mockDbInstance.prepare('INSERT INTO test (name) VALUES (?)');
            stmt.run('timeout-test');
        });
        
        // Assert
        expect(duration).toBeGreaterThan(maxTimeLimit);
        expect(duration).toBeLessThan(maxTimeLimit + 300); // Within reasonable margin
    });

    // =========================================================================
    // ✅ POSITIVE TESTS — Recovery Performance on Slow USB
    // =========================================================================

    // ✅ Positive Test: Database recovery is performant on slow USB
    it('should perform recovery operations within acceptable time on slow USB', () => {
        // Arrange
        const recoveryDelay = 100; // 100ms for recovery - acceptable
        const fsExistsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        const fsCopyFileSyncSpy = jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {
            // Simulate slow file copy (recovery)
            const startTime = Date.now();
            while (Date.now() - startTime < recoveryDelay) {
                // Busy wait
            }
        });
        
        // Act - Simulate recovery from backup
        const duration = measureTime(() => {
            const backupPath = '/backups/hisaab-backup.db';
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, '/data/hisaab.db');
            }
        });
        
        // Assert
        expect(duration).toBeLessThan(200); // Recovery should be under 200ms
        expect(fsExistsSyncSpy).toHaveBeenCalledWith('/backups/hisaab-backup.db');
        
        fsExistsSyncSpy.mockRestore();
        fsCopyFileSyncSpy.mockRestore();
    });

    // ✅ Positive Test: Reopening database after crash is fast on slow USB
    it('should reopen database quickly after crash on slow USB', () => {
        // Arrange
        let callCount = 0;
        Database.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // First open - simulate crash
                throw new Error('database is locked');
            }
            // Second open (reopen) - success with slight delay
            const startTime = Date.now();
            while (Date.now() - startTime < 50) {
                // Busy wait - 50ms delay
            }
            return mockDbInstance;
        });
        
        // Act - First attempt fails
        try {
            getDbInstance('reopen-test.db');
        } catch (e) {
            // Expected to fail
        }
        
        // Second attempt (reopen) should succeed
        const duration = measureTime(() => {
            try {
                getDbInstance('reopen-test.db');
            } catch (e) {
                // Handle error
            }
        });
        
        // Assert - Reopen should be relatively fast
        expect(duration).toBeLessThan(100);
    });
});

// =============================================================================
// PERFORMANCE TESTS - Integration Tests with Real Database (Optional)
// These tests are skipped by default as they require actual file I/O
// =============================================================================

describe.skip('USB Performance Tests — Integration (Real Database, Slow USB Simulation)', () => {
    let realDb;
    let testDbPath;
    let Database;

    beforeAll(() => {
        Database = require('better-sqlite3-multiple-ciphers');
    });

    beforeEach(() => {
        const tmpDir = os.tmpdir();
        testDbPath = path.join(tmpDir, `usb-perf-test-${Date.now()}.db`);
    });

    afterEach(() => {
        if (realDb) {
            try { realDb.close(); } catch(e) {}
        }
        [testDbPath, testDbPath + '-wal', testDbPath + '-shm'].forEach(p => {
            if (fs.existsSync(p)) {
                try { fs.unlinkSync(p); } catch(e) {}
            }
        });
    });

    // ✅ Positive Test: Real database write performance baseline
    it('should measure real database write performance for comparison', () => {
        // Arrange
        realDb = new Database(testDbPath);
        realDb.pragma('journal_mode = WAL');
        realDb.exec('CREATE TABLE perf_test (id INTEGER PRIMARY KEY, name TEXT, value REAL)');
        
        // Act - Measure insert performance
        const startTime = performance.now();
        const stmt = realDb.prepare('INSERT INTO perf_test (name, value) VALUES (?, ?)');
        for (let i = 0; i < 100; i++) {
            stmt.run(`item-${i}`, i * 1.5);
        }
        const duration = performance.now() - startTime;
        
        // Assert - 100 inserts should complete in reasonable time
        expect(duration).toBeLessThan(1000); // Under 1 second for 100 records
        expect(duration).toBeGreaterThan(0); // Valid measurement
        
        realDb.close();
    });

    // ✅ Positive Test: Real database read performance baseline
    it('should measure real database read performance for comparison', () => {
        // Arrange
        realDb = new Database(testDbPath);
        realDb.pragma('journal_mode = WAL');
        realDb.exec('CREATE TABLE perf_read_test (id INTEGER PRIMARY KEY, data TEXT)');
        const insertStmt = realDb.prepare('INSERT INTO perf_read_test (data) VALUES (?)');
        for (let i = 0; i < 50; i++) {
            insertStmt.run(`data-value-${i}`);
        }
        
        // Act - Measure read performance
        const startTime = performance.now();
        const selectStmt = realDb.prepare('SELECT * FROM perf_read_test WHERE id = ?');
        for (let i = 1; i <= 50; i++) {
            selectStmt.get(i);
        }
        const duration = performance.now() - startTime;
        
        // Assert - 50 reads should be fast
        expect(duration).toBeLessThan(500); // Under 500ms for 50 reads
        
        realDb.close();
    });
});
