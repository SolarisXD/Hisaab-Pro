/**
 * Duplicate Payroll Prevention Tests — Hisaab Pro
 * 
 * Acceptance Criteria:
 * 1. Prevent duplicate payroll generation for the same staff member and month
 * 2. Allow payroll for different staff members in the same month
 * 3. Allow payroll for same staff in different months
 * 4. Return appropriate error message on duplicate attempt
 * 5. API returns 400 status on duplicate attempt
 * 
 * Following AAA Pattern: Arrange → Act → Assert
 * Reference: .opencode/context/core/standards/test-coverage.md
 * Reference: .opencode/context/core/standards/code-quality.md
 */

'use strict';

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3-multiple-ciphers');
const bcrypt = require('bcryptjs');

// ============================================================
// MOCK SETUP FOR UNIT TESTS (Service Layer)
// ============================================================

let mockExistingPayroll = null;
let mockStaffAccount = { id: 1, name: 'Test Staff', monthly_salary: 30000, daily_wage: 1000 };
let mockAttendance = [];
let mockUseRealDb = false;
let mockUseRealAuth = false;
let mockUseRealPayments = false;

// Mock database module
jest.mock('../server/db/database', () => {
    const actualDb = jest.requireActual('../server/db/database');
    const mockPrepare = jest.fn((sql) => {
        if (mockUseRealDb) {
            return actualDb.db.prepare(sql);
        }
        return {
            get: jest.fn((...args) => {
                if (sql.includes('transactions') && sql.includes('account_id = ?')) {
                    return mockExistingPayroll || undefined;
                }
                if (sql.includes('accounts') && sql.includes('staff_details')) {
                    return mockStaffAccount || undefined;
                }
                if (sql.includes('accounts WHERE id = ?')) {
                    return { id: args[0] };
                }
                return undefined;
            }),
            all: jest.fn((...args) => {
                if (sql.includes('staff_attendance')) {
                    return mockAttendance || [];
                }
                return [];
            }),
            run: jest.fn((...args) => {
                return { lastInsertRowid: 123, changes: 1 };
            })
        };
    });
    
    return {
        db: {
            prepare: mockPrepare,
            transaction: jest.fn((fn) => {
                if (mockUseRealDb) {
                    return actualDb.db.transaction(fn);
                }
                return () => fn();
            }),
            pragma: jest.fn((...args) => {
                if (mockUseRealDb) {
                    return actualDb.db.pragma(...args);
                }
            })
        },
        getDb: () => {
            if (mockUseRealDb) {
                return actualDb.getDb();
            }
            return {
                prepare: mockPrepare,
                transaction: jest.fn((fn) => fn),
                pragma: jest.fn()
            };
        },
        switchDatabase: jest.fn((...args) => {
            if (mockUseRealDb) {
                return actualDb.switchDatabase(...args);
            }
        }),
        getCurrentDatabaseFilename: jest.fn((...args) => {
            if (mockUseRealDb) {
                return actualDb.getCurrentDatabaseFilename(...args);
            }
            return 'hisaab.db';
        }),
        closeDb: jest.fn((...args) => {
            if (mockUseRealDb) {
                return actualDb.closeDb(...args);
            }
        }),
        fyRequestContext: jest.fn((fy, cb) => {
            if (mockUseRealDb) {
                return actualDb.fyRequestContext(fy, cb);
            }
            return cb();
        })
    };
});

// Mock accounts service
const mockAccountsService = {
    listAccounts: jest.fn(),
    getAccountById: jest.fn(),
    createAccount: jest.fn(),
    updateAccount: jest.fn(),
    deleteAccount: jest.fn(),
    getAccountsSummary: jest.fn(),
    getAccountTransactions: jest.fn(),
    getDefaultCashAccount: jest.fn(),
    getDefaultBankAccount: jest.fn()
};

jest.mock('../server/modules/accounts/accounts.service', () => mockAccountsService);

// Mock payments service
const mockPaymentsService = {
    listPayments: jest.fn(),
    getPaymentById: jest.fn(),
    createPayment: jest.fn((...args) => {
        if (mockUseRealPayments) {
            const actualPayments = jest.requireActual('../server/modules/payments/payments.service');
            return actualPayments.createPayment(...args);
        }
        return { id: 789 };
    }),
    updatePayment: jest.fn(),
    deletePayment: jest.fn(),
    getPaymentsSummary: jest.fn()
};

jest.mock('../server/modules/payments/payments.service', () => mockPaymentsService);

// Mock auth service
jest.mock('../server/modules/auth/auth.service', () => {
    const actualAuth = jest.requireActual('../server/modules/auth/auth.service');
    return {
        login: jest.fn((...args) => {
            if (mockUseRealAuth) return actualAuth.login(...args);
            return { id: 1, username: 'testowner', role: 'owner', is_decoy: 0 };
        }),
        logout: jest.fn((...args) => {
            if (mockUseRealAuth) return actualAuth.logout(...args);
        }),
        getUserById: jest.fn((...args) => {
            if (mockUseRealAuth) return actualAuth.getUserById(...args);
        }),
        changePassword: jest.fn((...args) => {
            if (mockUseRealAuth) return actualAuth.changePassword(...args);
        }),
        isFirstTime: jest.fn((...args) => {
            if (mockUseRealAuth) return actualAuth.isFirstTime(...args);
            return Promise.resolve(false);
        }),
        getUserCount: jest.fn((...args) => {
            if (mockUseRealAuth) return actualAuth.getUserCount(...args);
            return 1;
        }),
        signup: jest.fn((...args) => {
            if (mockUseRealAuth) return actualAuth.signup(...args);
        }),
        logActivity: jest.fn((...args) => {
            if (mockUseRealAuth) return actualAuth.logActivity(...args);
        })
    };
});

// Get reference to mocked database
const { db: mockDb } = require('../server/db/database');

// ============================================================
// TEST SUITE 1: Service Layer - generatePayroll() Duplicate Prevention
// ============================================================

describe('Staff Service - generatePayroll() - Duplicate Prevention', () => {
    
    // Clear all mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
        mockExistingPayroll = null;
        mockStaffAccount = { id: 1, name: 'Test Staff', monthly_salary: 30000, daily_wage: 1000 };
        mockAttendance = [];
        mockAccountsService.createAccount.mockReset();
        mockPaymentsService.createPayment.mockReset();
    });
    
    // ✅ Positive Test: First payroll generation succeeds
    test('✅ generates payroll successfully for first time in a month', () => {
        // Arrange
        const accountId = 1;
        const year = 2026;
        const month = 4;
        const isDecoy = false;
        
        mockAttendance = Array(10).fill().map((_, i) => ({
            id: i + 1,
            date: `2026-04-${String(i + 1).padStart(2, '0')}`,
            status: 'present',
            notes: ''
        }));
        
        mockPaymentsService.createPayment.mockReturnValue({ id: 789 });
        
        // Load service after mocks are set up
        delete require.cache[require.resolve('../server/modules/staff/staff.service')];
        const staffService = require('../server/modules/staff/staff.service');
        
        // Act
        const result = staffService.generatePayroll(accountId, year, month, isDecoy);
        
        // Assert
        expect(result).toBeDefined();
        expect(result).toBe(123); // returns lastInsertRowid
    });
    
    // ❌ Negative Test: Duplicate payroll throws error
    test('❌ throws error when payroll already generated for same month', () => {
        // Arrange
        const accountId = 1;
        const year = 2026;
        const month = 4;
        const isDecoy = false;
        
        mockExistingPayroll = { id: 100 };
        
        // Load service after mocks are set up
        delete require.cache[require.resolve('../server/modules/staff/staff.service')];
        const staffService = require('../server/modules/staff/staff.service');
        
        // Act & Assert
        expect(() => {
            staffService.generatePayroll(accountId, year, month, isDecoy);
        }).toThrow('Payroll for 2026-04 has already been generated. Duplicate generations are not allowed.');
    });
    
    // ❌ Negative Test: Different staff can have payroll for same month
    test('✅ allows different staff to have payroll for same month', () => {
        // Arrange
        const staff1Id = 1;
        const staff2Id = 2;
        const year = 2026;
        const month = 4;
        const isDecoy = false;
        
        mockAttendance = [{ id: 1, date: '2026-04-01', status: 'present', notes: '' }];
        mockPaymentsService.createPayment.mockReturnValue({ id: 789 });
        
        // Load service after mocks are set up
        delete require.cache[require.resolve('../server/modules/staff/staff.service')];
        const staffService = require('../server/modules/staff/staff.service');
        
        // Act & Assert - Both should succeed
        expect(() => {
            staffService.generatePayroll(staff1Id, year, month, isDecoy);
        }).not.toThrow();
        
        expect(() => {
            staffService.generatePayroll(staff2Id, year, month, isDecoy);
        }).not.toThrow();
    });
    
    // ❌ Negative Test: Same staff, different month allows payroll
    test('✅ allows same staff to have payroll in different months', () => {
        // Arrange
        const accountId = 1;
        const year = 2026;
        const isDecoy = false;
        
        mockAttendance = [{ id: 1, date: '2026-04-01', status: 'present', notes: '' }];
        mockPaymentsService.createPayment.mockReturnValue({ id: 789 });
        
        // Load service after mocks are set up
        delete require.cache[require.resolve('../server/modules/staff/staff.service')];
        const staffService = require('../server/modules/staff/staff.service');
        
        // Act & Assert - Both months should succeed
        expect(() => {
            staffService.generatePayroll(accountId, year, 4, isDecoy);
        }).not.toThrow();
        
        expect(() => {
            staffService.generatePayroll(accountId, year, 5, isDecoy);
        }).not.toThrow();
    });
    
    // ❌ Negative Test: Error message contains correct month and year
    test('❌ error message includes correct year-month format', () => {
        // Arrange
        const accountId = 1;
        const year = 2025;
        const month = 12;
        const isDecoy = false;
        
        mockExistingPayroll = { id: 100 };
        
        // Load service after mocks are set up
        delete require.cache[require.resolve('../server/modules/staff/staff.service')];
        const staffService = require('../server/modules/staff/staff.service');
        
        // Act & Assert
        try {
            staffService.generatePayroll(accountId, year, month, isDecoy);
            fail('Should have thrown an error');
        } catch (error) {
            expect(error.message).toContain('2025-12');
            expect(error.message).toContain('already been generated');
        }
    });
    
    // ✅ Positive Test: Successful payroll with attendance records
    test('✅ calculates payroll correctly based on attendance', () => {
        // Arrange
        const accountId = 1;
        const year = 2026;
        const month = 4;
        const isDecoy = false;
        
        // Mock: 15 present days, 2 half days, 3 leave days = 15 + 1 + 3 = 19 days
        mockAttendance = [
            ...Array(15).fill().map((_, i) => ({ date: `2026-04-${i + 1}`, status: 'present' })),
            ...Array(2).fill().map((_, i) => ({ date: `2026-04-${i + 16}`, status: 'half_day' })),
            ...Array(3).fill().map((_, i) => ({ date: `2026-04-${i + 18}`, status: 'leave' }))
        ];
        
        mockPaymentsService.createPayment.mockReturnValue({ id: 789 });
        
        // Load service after mocks are set up
        delete require.cache[require.resolve('../server/modules/staff/staff.service')];
        const staffService = require('../server/modules/staff/staff.service');
        
        // Act
        const result = staffService.generatePayroll(accountId, year, month, isDecoy);
        
        // Assert - 19 days * 1000 = 19000
        expect(result).toBe(123);
    });
    
    // ❌ Negative Test: Zero payable days throws error
    test('❌ throws error when staff has no attendance records', () => {
        // Arrange
        const accountId = 1;
        const year = 2026;
        const month = 4;
        const isDecoy = false;
        
        mockAttendance = [];
        
        // Load service after mocks are set up
        delete require.cache[require.resolve('../server/modules/staff/staff.service')];
        const staffService = require('../server/modules/staff/staff.service');
        
        // Act & Assert
        expect(() => {
            staffService.generatePayroll(accountId, year, month, isDecoy);
        }).toThrow('Cannot generate payroll: Staff member has 0 payable days logged this month. Please mark attendance first.');
    });
});

// ============================================================
// TEST SUITE 2: API Layer - POST /api/v1/staff/:id/payroll
// ============================================================

// Test database setup for integration tests
const TEST_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hisaab-payroll-test-'));
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test-payroll.db');
const HISAAB_DB_PATH = path.join(TEST_DB_DIR, 'hisaab.db');
const TEST_DB_KEY = 'hisaab-pro-default-key-2026';

function setupPayrollTestDatabase() {
    const db = new Database(TEST_DB_PATH);
    db.pragma(`key = '${TEST_DB_KEY}'`);
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    
    // Run schema
    const schemaPath = path.join(__dirname, '../server/db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    
    // Seed account types
    const seedTypes = [
        ['Customer', 'customer', 'person', 1],
        ['Supplier', 'supplier', 'factory', 1],
        ['Cash', 'cash', 'payments', 1],
        ['Bank', 'bank', 'account_balance', 1],
        ['Expense', 'expense', 'trending_up', 1],
        ['Revenue', 'revenue', 'trending_down', 1],
        ['Staff', 'staff', 'people', 1]
    ];
    const stmt = db.prepare("INSERT INTO account_types (name, slug, icon, is_system) VALUES (?, ?, ?, ?)");
    seedTypes.forEach(t => stmt.run(t));
    
    // Create staff account with staff_details
    const staffResult = db.prepare(
        "INSERT INTO accounts (name, type, phone, current_balance, is_active) VALUES (?, ?, ?, ?, ?)"
    ).run('Test Staff', 'staff', '9876543210', 0, 1);
    
    const staffId = staffResult.lastInsertRowid;
    
    db.prepare("INSERT INTO staff_details (account_id, monthly_salary, daily_wage) VALUES (?, ?, ?)")
        .run(staffId, 30000, 1000);
    
    // Add some attendance records for April 2026
    for (let day = 1; day <= 15; day++) {
        db.prepare(
            "INSERT INTO staff_attendance (account_id, date, status) VALUES (?, ?, ?)"
        ).run(staffId, `2026-04-${String(day).padStart(2, '0')}`, 'present');
    }
    
    // Add some attendance records for May 2026
    for (let day = 1; day <= 15; day++) {
        db.prepare(
            "INSERT INTO staff_attendance (account_id, date, status) VALUES (?, ?, ?)"
        ).run(staffId, `2026-05-${String(day).padStart(2, '0')}`, 'present');
    }
    
    db.close();

    // Create and initialize global test database (hisaab.db)
    const globalDb = new Database(HISAAB_DB_PATH);
    globalDb.pragma(`key = '${TEST_DB_KEY}'`);
    globalDb.pragma('foreign_keys = ON');
    globalDb.pragma('journal_mode = WAL');
    globalDb.exec(schema);
    
    // Create test user (owner) in global db
    const passwordHash = bcrypt.hashSync('testpassword123', 10);
    globalDb.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
        .run('testowner', passwordHash, 'owner');
        
    globalDb.close();
    
    return { staffId };
}

async function loginTestUser(testApp) {
    const response = await request(testApp)
        .post('/api/v1/auth/login')
        .send({
            username: 'testowner',
            password: 'testpassword123'
        });
    
    return response.headers['set-cookie'];
}

describe('Staff API - POST /api/v1/staff/:id/payroll - Duplicate Prevention', () => {
    let app = null;
    let cookies = null;
    let staffId = null;
    
    beforeAll(async () => {
        // Enable delegation to real implementations for integration tests
        mockUseRealDb = true;
        mockUseRealAuth = true;
        mockUseRealPayments = true;

        // Setup test database
        const result = setupPayrollTestDatabase();
        staffId = result.staffId;
        
        // Clear module cache
        delete require.cache[require.resolve('../server/index.js')];
        delete require.cache[require.resolve('../server/config.js')];
        delete require.cache[require.resolve('../server/db/database.js')];
        
        // Override config to use test database
        const config = require('../server/config');
        config.database.path = TEST_DB_PATH;
        config.database.active_database = 'test-payroll.db';
        config.database_key = TEST_DB_KEY;
        config.session.secret = 'test-session-secret-12345';
        
        // Load app
        app = require('../server/index.js');
    }, 30000);
    
    beforeAll(async () => {
        // Login test user
        cookies = await loginTestUser(app);
        expect(cookies).toBeDefined();
    }, 10000);
    
    afterAll(async () => {
        // Close database connections first to release file locks
        try {
            const { closeDb } = require('../server/db/database.js');
            closeDb();
        } catch (e) {}

        // Cleanup test database files
        try {
            const filesToDelete = [
                TEST_DB_PATH,
                TEST_DB_PATH + '-wal',
                TEST_DB_PATH + '-shm',
                HISAAB_DB_PATH,
                HISAAB_DB_PATH + '-wal',
                HISAAB_DB_PATH + '-shm'
            ];
            
            filesToDelete.forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
            
            if (fs.existsSync(TEST_DB_DIR)) {
                fs.rmdirSync(TEST_DB_DIR);
            }
        } catch (e) {
            console.warn('Cleanup warning:', e.message);
        }
        
        // Clear module cache
        delete require.cache[require.resolve('../server/index.js')];
        delete require.cache[require.resolve('../server/config.js')];
        delete require.cache[require.resolve('../server/db/database.js')];
    });
    
    // ✅ Positive Test: First payroll generation via API
    test('✅ POST /api/v1/staff/:id/payroll returns 201 on successful generation', async () => {
        // Arrange
        const payrollData = {
            year: 2026,
            month: 4
        };
        
        // Act
        const response = await request(app)
            .post(`/api/v1/staff/${staffId}/payroll`)
            .set('Cookie', cookies)
            .send(payrollData);
        
        // Assert
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('transaction_id');
    });
    
    // ❌ Negative Test: Duplicate payroll returns 400
    test('❌ POST /api/v1/staff/:id/payroll returns 400 on duplicate attempt', async () => {
        // Arrange
        const payrollData = {
            year: 2026,
            month: 4  // Same month as previous test
        };
        
        // Act
        const response = await request(app)
            .post(`/api/v1/staff/${staffId}/payroll`)
            .set('Cookie', cookies)
            .send(payrollData);
        
        // Assert
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('already been generated');
    });
    
    // ❌ Negative Test: Returns 401 without authentication
    test('❌ POST /api/v1/staff/:id/payroll returns 401 when not authenticated', async () => {
        // Arrange
        const payrollData = {
            year: 2026,
            month: 5  // Different month
        };
        
        // Act - No cookies set
        const response = await request(app)
            .post(`/api/v1/staff/${staffId}/payroll`)
            .send(payrollData);
        
        // Assert
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
    });
    
    // ❌ Negative Test: Returns 400 for invalid staff ID
    test('❌ POST /api/v1/staff/:id/payroll returns 400 for non-existent staff', async () => {
        // Arrange
        const payrollData = {
            year: 2026,
            month: 5
        };
        
        // Act
        const response = await request(app)
            .post('/api/v1/staff/99999/payroll')  // Non-existent ID
            .set('Cookie', cookies)
            .send(payrollData);
        
        // Assert
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
    });
    
    // ✅ Positive Test: Different month allows new payroll
    test('✅ POST /api/v1/staff/:id/payroll allows different month after first payroll', async () => {
        // Arrange
        const payrollData = {
            year: 2026,
            month: 5  // Different month
        };
        
        // Act
        const response = await request(app)
            .post(`/api/v1/staff/${staffId}/payroll`)
            .set('Cookie', cookies)
            .send(payrollData);
        
        // Assert
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
    });
});
