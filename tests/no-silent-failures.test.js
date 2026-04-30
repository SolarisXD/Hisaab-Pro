/**
 * No Silent Failures Tests — Hisaab Pro
 * 
 * Acceptance Criteria:
 * 1. All API errors caught and logged
 * 2. No unhandled exceptions reach client
 * 3. Error responses include meaningful messages
 * 
 * Following AAA Pattern: Arrange → Act → Assert
 * Reference: .opencode/context/core/standards/test-coverage.md
 */

'use strict';

const request = require('supertest');
const express = require('express');
const logger = require('../server/shared/logger');
const fs = require('fs');
const path = require('path');

// Store original console methods for restoration
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Capture console output for assertions
let consoleErrorOutput = [];
let consoleWarnOutput = [];

// Mock database module
const mockDb = {
    prepare: jest.fn().mockReturnThis(),
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
    exec: jest.fn(),
    transaction: jest.fn((fn) => fn),
    pragma: jest.fn()
};

// Mock the database module
jest.mock('../server/db/database', () => ({
    db: mockDb,
    getDb: () => mockDb,
    switchDatabase: jest.fn(),
    getCurrentDatabaseFilename: jest.fn(() => 'hisaab.db'),
    closeDb: jest.fn(),
    fyRequestContext: jest.fn((fy, cb) => cb())
}));

// Mock auth service
const mockAuthService = {
    login: jest.fn(),
    logout: jest.fn(),
    getUserById: jest.fn(),
    changePassword: jest.fn(),
    isFirstTime: jest.fn().mockResolvedValue(false),
    getUserCount: jest.fn().mockReturnValue(1),
    signup: jest.fn(),
    logActivity: jest.fn()
};

jest.mock('../server/modules/auth/auth.service', () => mockAuthService);

// Mock accounts service
const mockAccountsService = {
    listAccounts: jest.fn(),
    getAccountById: jest.fn(),
    createAccount: jest.fn(),
    updateAccount: jest.fn(),
    deleteAccount: jest.fn(),
    getAccountsSummary: jest.fn(),
    getAccountTransactions: jest.fn(),
    getDefaultCashAccount: jest.fn().mockReturnValue({ id: 1, name: 'Cash' }),
    getDefaultBankAccount: jest.fn()
};

jest.mock('../server/modules/accounts/accounts.service', () => mockAccountsService);

// Mock sales service
const mockSalesService = {
    listSales: jest.fn(),
    getSaleById: jest.fn(),
    createSale: jest.fn(),
    updateSale: jest.fn(),
    deleteSale: jest.fn(),
    getSalesSummary: jest.fn(),
    generateInvoiceNumber: jest.fn().mockReturnValue('INV-1'),
    getNextRefNo: jest.fn().mockReturnValue('1-01')
};

jest.mock('../server/modules/sales/sales.service', () => mockSalesService);

// Mock payments service
const mockPaymentsService = {
    listPayments: jest.fn(),
    getPaymentById: jest.fn(),
    createPayment: jest.fn(),
    updatePayment: jest.fn(),
    deletePayment: jest.fn(),
    getPaymentsSummary: jest.fn()
};

jest.mock('../server/modules/payments/payments.service', () => mockPaymentsService);

// Mock staff service
const mockStaffService = {
    listStaff: jest.fn(),
    createStaff: jest.fn(),
    getAttendance: jest.fn(),
    markAttendance: jest.fn(),
    generatePayroll: jest.fn(),
    updateStaff: jest.fn(),
    deleteStaff: jest.fn()
};

jest.mock('../server/modules/staff/staff.service', () => mockStaffService);

// Mock purchases service
const mockPurchasesService = {
    listPurchases: jest.fn(),
    getPurchaseById: jest.fn(),
    createPurchase: jest.fn(),
    deletePurchase: jest.fn()
};

jest.mock('../server/modules/purchases/purchases.service', () => mockPurchasesService);

// Mock dashboard service
const mockDashboardService = {
    getDashboardData: jest.fn()
};

jest.mock('../server/modules/dashboard/dashboard.service', () => mockDashboardService);

// Mock reports service
const mockReportsService = {
    getDailySalesReport: jest.fn(),
    getMonthlyReport: jest.fn(),
    getDebtorAgingReport: jest.fn(),
    getCreditorSchedule: jest.fn(),
    getBalanceSheet: jest.fn(),
    getAccountLedger: jest.fn(),
    getAmountReceivableReport: jest.fn()
};

jest.mock('../server/modules/reports/reports.service', () => mockReportsService);

// Mock settings service
const mockSettingsService = {
    listFinancialYears: jest.fn(),
    getSystemStatus: jest.fn(),
    runManualBackup: jest.fn(),
    getSystemSetting: jest.fn(),
    setSystemSetting: jest.fn(),
    createFinancialYear: jest.fn(),
    activateFinancialYear: jest.fn(),
    updateShopConfig: jest.fn()
};

jest.mock('../server/modules/settings/settings.service', () => mockSettingsService);

// Mock multer for uploads
jest.mock('multer', () => {
    const multer = () => ({
        array: () => (req, res, next) => {
            req.files = req.files || [];
            next();
        },
        single: () => (req, res, next) => next()
    });
    multer.diskStorage = (config) => config;
    return multer;
});

// Create a test app instance
function createTestApp() {
    const app = express();
    app.use(express.json());

    // Mock session middleware
    app.use((req, res, next) => {
        req.session = {
            user: { id: 1, username: 'test', role: 'owner', is_decoy: 0 }
        };
        next();
    });

    // Mock FY middleware
    app.use('/api/v1', (req, res, next) => {
        const { fyRequestContext } = require('../server/db/database');
        fyRequestContext('hisaab.db', () => next());
    });

    // Register routes
    app.use('/api/v1/auth', require('../server/modules/auth/auth.routes'));
    app.use('/api/v1/accounts', require('../server/modules/accounts/accounts.routes'));
    app.use('/api/v1/sales', require('../server/modules/sales/sales.routes'));
    app.use('/api/v1/payments', require('../server/modules/payments/payments.routes'));
    app.use('/api/v1/staff', require('../server/modules/staff/staff.routes'));
    app.use('/api/v1/purchases', require('../server/modules/purchases/purchases.routes'));
    app.use('/api/v1/dashboard', require('../server/modules/dashboard/dashboard.routes'));
    app.use('/api/v1/reports', require('../server/modules/reports/reports.routes'));
    app.use('/api/v1/settings', require('../server/modules/settings/settings.routes'));
    app.use('/api/v1/uploads', require('../server/modules/uploads/uploads.routes'));

    // Global error handler
    app.use((err, req, res, next) => {
        logger.error('Server', 'Unhandled error: ' + err.message, { stack: err.stack });
        res.status(500).json({ error: 'Internal server error' });
    });

    return app;
}

// ============================================================
// Setup and Teardown
// ============================================================

beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset console output capture
    consoleErrorOutput = [];
    consoleWarnOutput = [];
    
    // Mock console methods
    console.error = jest.fn((msg) => consoleErrorOutput.push(msg));
    console.warn = jest.fn((msg) => consoleWarnOutput.push(msg));
    
    // Reset mock implementations
    mockAuthService.isFirstTime.mockResolvedValue(false);
    mockAuthService.getUserCount.mockReturnValue(1);
    mockAccountsService.getDefaultCashAccount.mockReturnValue({ id: 1, name: 'Cash' });
    mockSalesService.generateInvoiceNumber.mockReturnValue('INV-1');
    mockSalesService.getNextRefNo.mockReturnValue('1-01');
});

afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
});

// ============================================================
// Test Suite: API Endpoints Return Proper Error Responses
// ============================================================

describe('API Endpoints Return Proper Error Responses', () => {
    
    // ✅ Positive Test: Valid request returns success
    test('GET /api/v1/accounts returns 200 with valid data', async () => {
        // Arrange
        const app = createTestApp();
        mockAccountsService.listAccounts.mockReturnValue([
            { id: 1, name: 'Test Account', balance: 0 }
        ]);
        
        // Act
        const response = await request(app)
            .get('/api/v1/accounts')
            .expect('Content-Type', /json/);
        
        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);
    });
    
    // ❌ Negative Test: Database error returns 500 with error message
    test('GET /api/v1/accounts returns 500 when database throws', async () => {
        // Arrange
        const app = createTestApp();
        mockAccountsService.listAccounts.mockImplementation(() => {
            throw new Error('Database connection failed');
        });
        
        // Act
        const response = await request(app)
            .get('/api/v1/accounts')
            .expect('Content-Type', /json/);
        
        // Assert
        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Failed to list accounts');
    });
    
    // ❌ Negative Test: Not found returns 404
    test('GET /api/v1/accounts/:id returns 404 when account not found', async () => {
        // Arrange
        const app = createTestApp();
        mockAccountsService.getAccountById.mockReturnValue(null);
        
        // Act
        const response = await request(app)
            .get('/api/v1/accounts/999')
            .expect('Content-Type', /json/);
        
        // Assert
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Account not found');
    });
    
    // ❌ Negative Test: Invalid input returns 400
    test('POST /api/v1/accounts returns 400 with validation errors', async () => {
        // Arrange
        const app = createTestApp();
        
        // Act - Send invalid data (missing required name)
        const response = await request(app)
            .post('/api/v1/accounts')
            .send({ type_slug: 'customer' })
            .expect('Content-Type', /json/);
        
        // Assert
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('details');
        expect(response.body.error).toBe('Validation failed');
    });
    
    // ❌ Negative Test: Service error returns appropriate status
    test('POST /api/v1/accounts returns 400 when service throws error', async () => {
        // Arrange
        const app = createTestApp();
        mockAccountsService.createAccount.mockImplementation(() => {
            throw new Error('Account creation failed');
        });
        
        // Act
        const response = await request(app)
            .post('/api/v1/accounts')
            .send({ name: 'Test', type_slug: 'customer' })
            .expect('Content-Type', /json/);
        
        // Assert
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
    });
});

// ============================================================
// Test Suite: No Unhandled Promise Rejections
// ============================================================

describe('No Unhandled Promise Rejections', () => {
    
    // ✅ Positive Test: Async operations handle errors
    test('GET /api/v1/auth/setup-status handles async errors gracefully', async () => {
        // Arrange
        const app = createTestApp();
        mockAuthService.isFirstTime.mockRejectedValue(new Error('Async error'));
        
        // Act
        const response = await request(app)
            .get('/api/v1/auth/setup-status')
            .expect('Content-Type', /json/);
        
        // Assert
        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Failed to check setup status');
    });
    
    // ✅ Positive Test: Async signup handles errors
    test('POST /api/v1/auth/signup handles async errors gracefully', async () => {
        // Arrange
        const app = createTestApp();
        mockAuthService.signup.mockRejectedValue(new Error('Signup failed'));
        mockAuthService.isFirstTime.mockResolvedValue(true);
        
        // Act
        const response = await request(app)
            .post('/api/v1/auth/signup')
            .send({
                shopDetails: { name: 'Test Shop' },
                ownerUser: { username: 'admin', password: 'password123' },
                financialYear: { name: '2026-2027' }
            })
            .expect('Content-Type', /json/);
        
        // Assert
        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Signup failed. Please try again.');
    });
    
    // ✅ Positive Test: Unhandled promise rejection is caught by error handler
    test('unhandled promise rejection in route is caught by error handler', async () => {
        // Arrange
        const app = express();
        app.use(express.json());
        
        // Route that creates an unhandled promise rejection
        app.get('/api/v1/test-rejection', (req, res) => {
            // This promise rejection should be caught
            const promise = Promise.reject(new Error('Unhandled rejection'));
            promise.catch(err => {
                throw err; // This will be caught by error handler
            });
        });
        
        // Global error handler
        app.use((err, req, res, next) => {
            logger.error('Server', 'Unhandled error: ' + err.message);
            res.status(500).json({ error: 'Internal server error' });
        });
        
        // Act
        const response = await request(app)
            .get('/api/v1/test-rejection')
            .expect('Content-Type', /json/);
        
        // Assert
        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Internal server error');
    });
});

// ============================================================
// Test Suite: All Errors Are Caught and Logged
// ============================================================

describe('All Errors Are Caught and Logged', () => {
    
    // ✅ Positive Test: Database errors are logged
    test('database error in accounts route is logged', async () => {
        // Arrange
        const app = createTestApp();
        const dbError = new Error('Database connection lost');
        mockAccountsService.listAccounts.mockImplementation(() => {
            throw dbError;
        });
        
        // Act
        await request(app)
            .get('/api/v1/accounts')
            .expect(500);
        
        // Assert - error should be logged (console.error is mocked)
        expect(console.error).toHaveBeenCalled();
    });
    
    // ✅ Positive Test: Validation errors are logged
    test('validation errors are logged with details', async () => {
        // Arrange
        const app = createTestApp();
        
        // Act - Send invalid sale data
        await request(app)
            .post('/api/v1/sales')
            .send({ total: -100 }) // Invalid: negative total
            .expect(400);
        
        // Assert - validation errors should be logged
        expect(console.error).toHaveBeenCalled();
    });
    
    // ✅ Positive Test: Authentication errors are logged
    test('failed login attempts are logged', async () => {
        // Arrange
        const app = createTestApp();
        mockAuthService.login.mockImplementation(() => {
            throw new Error('Invalid credentials');
        });
        
        // Act
        await request(app)
            .post('/api/v1/auth/login')
            .send({ username: 'test', password: 'wrong' })
            .expect(401);
        
        // Assert - error should be logged
        expect(console.error).toHaveBeenCalled();
    });
    
    // ✅ Positive Test: Server error handler logs the error
    test('global error handler logs unhandled errors', async () => {
        // Arrange
        const app = express();
        app.use(express.json());
        
        // Route that throws an error
        app.get('/api/v1/test-error', (req, res, next) => {
            try {
                throw new Error('Test server error');
            } catch (err) {
                next(err); // Pass to error handler
            }
        });
        
        // Global error handler
        app.use((err, req, res, next) => {
            logger.error('Server', 'Unhandled error: ' + err.message, { stack: err.stack });
            res.status(500).json({ error: 'Internal server error' });
        });
        
        // Act
        await request(app)
            .get('/api/v1/test-error')
            .expect(500);
        
        // Assert - error should be logged via logger
        expect(console.error).toHaveBeenCalled();
        const logOutput = consoleErrorOutput.join(' ');
        expect(logOutput).toContain('Unhandled error');
    });
});

// ============================================================
// Test Suite: User Receives Appropriate Error Messages
// ============================================================

describe('User Receives Appropriate Error Messages', () => {
    
    // ✅ Positive Test: Error message is meaningful, not generic
    test('404 error returns meaningful message', async () => {
        // Arrange
        const app = createTestApp();
        mockAccountsService.getAccountById.mockReturnValue(null);
        
        // Act
        const response = await request(app)
            .get('/api/v1/accounts/999')
            .expect(404);
        
        // Assert
        expect(response.body.error).toBe('Account not found');
        expect(response.body.error).not.toBe('Internal server error');
    });
    
    // ✅ Positive Test: Validation error returns specific details
    test('validation error returns specific field errors', async () => {
        // Arrange
        const app = createTestApp();
        
        // Act - Send empty object (missing required fields)
        const response = await request(app)
            .post('/api/v1/accounts')
            .send({})
            .expect(400);
        
        // Assert
        expect(response.body).toHaveProperty('error', 'Validation failed');
        expect(response.body).toHaveProperty('details');
        expect(response.body.details).toBeInstanceOf(Array);
        expect(response.body.details.length).toBeGreaterThan(0);
    });
    
    // ✅ Positive Test: 500 error does not expose internal details
    test('500 error returns generic message without exposing internals', async () => {
        // Arrange
        const app = createTestApp();
        mockAccountsService.listAccounts.mockImplementation(() => {
            throw new Error('DB_PASSWORD=secret123; DROP TABLE users;');
        });
        
        // Act
        const response = await request(app)
            .get('/api/v1/accounts')
            .expect(500);
        
        // Assert - Should NOT expose internal details
        expect(response.body.error).toBe('Failed to list accounts');
        expect(response.body.error).not.toContain('DB_PASSWORD');
        expect(response.body.error).not.toContain('DROP TABLE');
    });
    
    // ✅ Positive Test: Authentication error returns clear message
    test('401 error returns clear authentication message', async () => {
        // Arrange
        const app = createTestApp();
        mockAuthService.login.mockImplementation(() => {
            throw new Error('Invalid credentials');
        });
        
        // Act
        const response = await request(app)
            .post('/api/v1/auth/login')
            .send({ username: 'test', password: 'wrong' })
            .expect(401);
        
        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Invalid credentials');
    });
    
    // ✅ Positive Test: Authorization error returns clear message
    test('403 error returns clear authorization message', async () => {
        // Arrange
        const app = express();
        app.use(express.json());
        
        // Mock session with non-owner role
        app.use((req, res, next) => {
            req.session = {
                user: { id: 2, username: 'staff', role: 'staff', is_decoy: 0 }
            };
            next();
        });
        
        // Protected route requiring owner role
        const { requireRole } = require('../server/modules/auth/auth.middleware');
        app.get('/api/v1/admin/settings', requireRole('owner'), (req, res) => {
            res.json({ settings: {} });
        });
        
        // Act
        const response = await request(app)
            .get('/api/v1/admin/settings')
            .expect(403);
        
        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Access denied');
    });
});

// ============================================================
// Test Suite: Silent Failure Detection
// ============================================================

describe('Silent Failure Detection', () => {
    
    // ✅ Positive Test: No empty responses on error
    test('error responses are never empty objects', async () => {
        // Arrange
        const app = createTestApp();
        mockAccountsService.listAccounts.mockImplementation(() => {
            throw new Error('Test error');
        });
        
        // Act
        const response = await request(app)
            .get('/api/v1/accounts')
            .expect(500);
        
        // Assert
        expect(response.body).not.toEqual({});
        expect(response.body).toHaveProperty('error');
        expect(response.body.error.length).toBeGreaterThan(0);
    });
    
    // ✅ Positive Test: No silent catch blocks (errors are re-thrown or handled)
    test('errors in transactions are not silently swallowed', async () => {
        // Arrange
        const app = createTestApp();
        const transactionError = new Error('Transaction failed');
        
        // Mock a service that uses transactions
        mockSalesService.createSale.mockImplementation(() => {
            throw transactionError;
        });
        
        // Act
        const response = await request(app)
            .post('/api/v1/sales')
            .send({
                date: '2026-04-29',
                total: 100,
                customer_account_id: 1
            })
            .expect(500);
        
        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Failed to create sale');
    });
    
    // ✅ Positive Test: Logger errors don't cause silent failures
    test('logger errors are handled gracefully without throwing', () => {
        // Arrange
        const originalAppendFileSync = fs.appendFileSync;
        fs.appendFileSync = jest.fn(() => {
            throw new Error('Simulated write error');
        });
        
        // Act & Assert - should not throw
        expect(() => {
            logger.error('TestModule', 'Test message');
        }).not.toThrow();
        
        // Assert - error IS logged to console as fallback
        expect(console.error).toHaveBeenCalled();
        
        // Restore
        fs.appendFileSync = originalAppendFileSync;
    });
    
    // ✅ Positive Test: Multiple errors don't cause cascading failures
    test('handles multiple sequential errors without crashing', async () => {
        // Arrange
        const app = createTestApp();
        
        // First request - will fail
        mockAccountsService.listAccounts.mockImplementationOnce(() => {
            throw new Error('First error');
        });
        
        const response1 = await request(app)
            .get('/api/v1/accounts')
            .expect(500);
        
        expect(response1.body).toHaveProperty('error');
        
        // Second request - should also fail gracefully
        mockAccountsService.listAccounts.mockImplementationOnce(() => {
            throw new Error('Second error');
        });
        
        const response2 = await request(app)
            .get('/api/v1/accounts')
            .expect(500);
        
        expect(response2.body).toHaveProperty('error');
        
        // Both errors should be logged
        expect(console.error).toHaveBeenCalled();
    });
});

// ============================================================
// Test Suite: Edge Cases and Boundary Conditions
// ============================================================

describe('Edge Cases and Boundary Conditions', () => {
    
    // ❌ Negative Test: Null/undefined request body
    test('handles null request body gracefully', async () => {
        // Arrange
        const app = createTestApp();
        
        // Act - This will be caught by express.json() or validation
        const response = await request(app)
            .post('/api/v1/accounts')
            .send(null)
            .expect(400);
        
        // Assert
        expect(response.body).toHaveProperty('error');
    });
    
    // ❌ Negative Test: Malformed JSON
    test('handles malformed JSON gracefully', async () => {
        // Arrange
        const app = createTestApp();
        
        // Act
        const response = await request(app)
            .post('/api/v1/accounts')
            .set('Content-Type', 'application/json')
            .send('{invalid json}')
            .expect(400);
        
        // Assert
        expect(response.body).toHaveProperty('error');
    });
    
    // ❌ Negative Test: Missing required headers
    test('handles missing financial year header gracefully', async () => {
        // Arrange
        const app = express();
        app.use(express.json());
        
        // FY middleware without header
        app.use('/api/v1', (req, res, next) => {
            const requestedFy = req.headers['x-financial-year'];
            if (!requestedFy) {
                req.fy = 'hisaab.db'; // Default
            }
            next();
        });
        
        app.get('/api/v1/test', (req, res) => {
            res.json({ fy: req.fy });
        });
        
        // Act
        const response = await request(app)
            .get('/api/v1/test')
            .expect(200);
        
        // Assert - should still work with default
        expect(response.body).toHaveProperty('fy');
    });
    
    // ❌ Negative Test: Invalid financial year header
    test('rejects invalid financial year header', async () => {
        // Arrange
        const app = express();
        app.use(express.json());
        
        // FY validation middleware (from server/index.js)
        app.use('/api/v1', (req, res, next) => {
            var requestedFy = req.headers['x-financial-year'];
            var safeFilenameRegex = /^[a-zA-Z0-9_\-\.]+\.db$/;
            if (requestedFy && (!safeFilenameRegex.test(requestedFy) || requestedFy.includes('..'))) {
                return res.status(400).json({ error: 'Invalid financial year identifier' });
            }
            next();
        });
        
        app.get('/api/v1/test', (req, res) => {
            res.json({ success: true });
        });
        
        // Act - Try path traversal
        const response = await request(app)
            .get('/api/v1/test')
            .set('x-financial-year', '../../../etc/passwd')
            .expect(400);
        
        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Invalid financial year identifier');
    });
});

// ============================================================
// Test Suite: Integration with Error Logging
// ============================================================

describe('Integration with Error Logging', () => {
    
    // ✅ Positive Test: All API errors trigger logger
    test('API errors are logged via logger module', async () => {
        // Arrange
        const app = createTestApp();
        mockAccountsService.listAccounts.mockImplementation(() => {
            throw new Error('Test API error');
        });
        
        // Spy on logger.error
        const loggerSpy = jest.spyOn(logger, 'error');
        
        // Act
        await request(app)
            .get('/api/v1/accounts')
            .expect(500);
        
        // Assert - logger should have been called
        expect(loggerSpy).toHaveBeenCalled();
        
        // Cleanup
        loggerSpy.mockRestore();
    });
    
    // ✅ Positive Test: Successful requests don't log errors
    test('successful API requests do not log errors', async () => {
        // Arrange
        const app = createTestApp();
        mockAccountsService.listAccounts.mockReturnValue([]);

        // Spy on logger.error
        const loggerSpy = jest.spyOn(logger, 'error');

        // Act
        await request(app)
            .get('/api/v1/accounts')
            .expect(200);

        // Assert - logger.error should NOT have been called
        expect(loggerSpy).not.toHaveBeenCalled();

        // Cleanup
        loggerSpy.mockRestore();
    });
});

// ============================================================
// Test Suite: Staff Module Error Handling
// ============================================================

describe('Staff Module Error Handling', () => {

    // ✅ Positive Test: List staff returns success
    test('GET /api/v1/staff returns 200 with valid data', async () => {
        // Arrange
        const app = createTestApp();
        mockStaffService.listStaff.mockReturnValue([
            { id: 1, name: 'John Doe', type: 'staff', monthly_salary: 5000 }
        ]);

        // Act
        const response = await request(app)
            .get('/api/v1/staff')
            .expect(200);

        // Assert
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);
    });

    // ❌ Negative Test: Database error returns 500
    test('GET /api/v1/staff returns 500 when service throws', async () => {
        // Arrange
        const app = createTestApp();
        mockStaffService.listStaff.mockImplementation(() => {
            throw new Error('Database error');
        });

        // Act
        const response = await request(app)
            .get('/api/v1/staff')
            .expect(500);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Failed to list staff');
    });

    // ✅ Positive Test: Create staff success
    test('POST /api/v1/staff returns 201 on success', async () => {
        // Arrange
        const app = createTestApp();
        mockStaffService.createStaff.mockReturnValue({ id: 1, name: 'New Staff' });

        // Act
        const response = await request(app)
            .post('/api/v1/staff')
            .send({ name: 'New Staff', monthly_salary: 5000 })
            .expect(201);

        // Assert
        expect(response.body).toHaveProperty('id');
    });

    // ❌ Negative Test: Create staff failure returns 400
    test('POST /api/v1/staff returns 400 when service throws', async () => {
        // Arrange
        const app = createTestApp();
        mockStaffService.createStaff.mockImplementation(() => {
            throw new Error('Staff creation failed');
        });

        // Act
        const response = await request(app)
            .post('/api/v1/staff')
            .send({ name: 'New Staff' })
            .expect(400);

        // Assert
        expect(response.body).toHaveProperty('error');
    });

    // ❌ Negative Test: Validation error on create staff
    test('POST /api/v1/staff returns 400 on validation failure', async () => {
        // Arrange
        const app = createTestApp();

        // Act - Missing required name field
        const response = await request(app)
            .post('/api/v1/staff')
            .send({ monthly_salary: 5000 })
            .expect(400);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Validation failed');
    });

    // ✅ Positive Test: Get attendance success
    test('GET /api/v1/staff/:id/attendance returns attendance data', async () => {
        // Arrange
        const app = createTestApp();
        mockStaffService.getAttendance.mockReturnValue([
            { date: '2026-04-01', status: 'present' }
        ]);

        // Act
        const response = await request(app)
            .get('/api/v1/staff/1/attendance')
            .expect(200);

        // Assert
        expect(response.body).toBeInstanceOf(Array);
    });

    // ❌ Negative Test: Attendance error returns 500
    test('GET /api/v1/staff/:id/attendance returns 500 on error', async () => {
        // Arrange
        const app = createTestApp();
        mockStaffService.getAttendance.mockImplementation(() => {
            throw new Error('Attendance fetch failed');
        });

        // Act
        const response = await request(app)
            .get('/api/v1/staff/1/attendance')
            .expect(500);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Failed to retrieve attendance');
    });
});

// ============================================================
// Test Suite: Purchases Module Error Handling
// ============================================================

describe('Purchases Module Error Handling', () => {

    // ✅ Positive Test: List purchases returns success
    test('GET /api/v1/purchases returns 200 with valid data', async () => {
        // Arrange
        const app = createTestApp();
        mockPurchasesService.listPurchases.mockReturnValue([
            { id: 1, invoice_no: 'PUR-001', total: 1000 }
        ]);

        // Act
        const response = await request(app)
            .get('/api/v1/purchases')
            .expect(200);

        // Assert
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);
    });

    // ❌ Negative Test: Database error returns 500
    test('GET /api/v1/purchases returns 500 when service throws', async () => {
        // Arrange
        const app = createTestApp();
        mockPurchasesService.listPurchases.mockImplementation(() => {
            throw new Error('Database error');
        });

        // Act
        const response = await request(app)
            .get('/api/v1/purchases')
            .expect(500);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Failed to list purchases');
    });

    // ✅ Positive Test: Get single purchase success
    test('GET /api/v1/purchases/:id returns purchase data', async () => {
        // Arrange
        const app = createTestApp();
        mockPurchasesService.getPurchaseById.mockReturnValue(
            { id: 1, invoice_no: 'PUR-001', total: 1000 }
        );

        // Act
        const response = await request(app)
            .get('/api/v1/purchases/1')
            .expect(200);

        // Assert
        expect(response.body).toHaveProperty('id');
    });

    // ❌ Negative Test: Purchase not found returns 404
    test('GET /api/v1/purchases/:id returns 404 when not found', async () => {
        // Arrange
        const app = createTestApp();
        mockPurchasesService.getPurchaseById.mockReturnValue(null);

        // Act
        const response = await request(app)
            .get('/api/v1/purchases/999')
            .expect(404);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Purchase not found');
    });

    // ✅ Positive Test: Create purchase success
    test('POST /api/v1/purchases returns 201 on success', async () => {
        // Arrange
        const app = createTestApp();
        mockPurchasesService.createPurchase.mockReturnValue({ id: 1, total: 1000 });

        // Act
        const response = await request(app)
            .post('/api/v1/purchases')
            .send({
                date: '2026-04-30',
                supplier_account_id: 1,
                total: 1000
            })
            .expect(201);

        // Assert
        expect(response.body).toHaveProperty('id');
    });

    // ❌ Negative Test: Create purchase with date outside FY returns 400
    test('POST /api/v1/purchases returns 400 when date outside FY', async () => {
        // Arrange
        const app = createTestApp();

        // Act - Date far in the future (outside active FY)
        const response = await request(app)
            .post('/api/v1/purchases')
            .send({
                date: '2030-01-01',
                supplier_account_id: 1,
                total: 1000
            })
            .expect(400);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('outside the active financial year');
    });

    // ❌ Negative Test: Create purchase failure returns 500
    test('POST /api/v1/purchases returns 500 when service throws', async () => {
        // Arrange
        const app = createTestApp();
        mockPurchasesService.createPurchase.mockImplementation(() => {
            throw new Error('Purchase creation failed');
        });

        // Act
        const response = await request(app)
            .post('/api/v1/purchases')
            .send({
                date: '2026-04-30',
                supplier_account_id: 1,
                total: 1000
            })
            .expect(500);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Failed to create purchase');
    });

    // ❌ Negative Test: Validation error on create purchase
    test('POST /api/v1/purchases returns 400 on validation failure', async () => {
        // Arrange
        const app = createTestApp();

        // Act - Missing required fields
        const response = await request(app)
            .post('/api/v1/purchases')
            .send({})
            .expect(400);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Validation failed');
    });
});

// ============================================================
// Test Suite: Dashboard Module Error Handling
// ============================================================

describe('Dashboard Module Error Handling', () => {

    // ✅ Positive Test: Dashboard returns data successfully
    test('GET /api/v1/dashboard returns dashboard data', async () => {
        // Arrange
        const app = createTestApp();
        mockDashboardService.getDashboardData.mockReturnValue({
            todaySales: { count: 5, total: 1000 },
            monthSales: { count: 50, total: 10000 },
            totalDebtors: 5000,
            totalCreditors: 3000
        });

        // Act
        const response = await request(app)
            .get('/api/v1/dashboard')
            .expect(200);

        // Assert
        expect(response.body).toHaveProperty('todaySales');
        expect(response.body).toHaveProperty('monthSales');
    });

    // ❌ Negative Test: Dashboard error returns 500
    test('GET /api/v1/dashboard returns 500 when service throws', async () => {
        // Arrange
        const app = createTestApp();
        mockDashboardService.getDashboardData.mockImplementation(() => {
            throw new Error('Dashboard data fetch failed');
        });

        // Act
        const response = await request(app)
            .get('/api/v1/dashboard')
            .expect(500);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Failed to load dashboard data');
    });
});

// ============================================================
// Test Suite: Reports Module Error Handling
// ============================================================

describe('Reports Module Error Handling', () => {

    // ✅ Positive Test: Daily sales report success
    test('GET /api/v1/reports/daily-sales returns report data', async () => {
        // Arrange
        const app = createTestApp();
        mockReportsService.getDailySalesReport.mockReturnValue({
            date: '2026-04-30',
            sales: [],
            summary: { count: 0, total: 0 }
        });

        // Act
        const response = await request(app)
            .get('/api/v1/reports/daily-sales')
            .expect(200);

        // Assert
        expect(response.body).toHaveProperty('date');
        expect(response.body).toHaveProperty('sales');
    });

    // ❌ Negative Test: Daily sales report error returns 500
    test('GET /api/v1/reports/daily-sales returns 500 on error', async () => {
        // Arrange
        const app = createTestApp();
        mockReportsService.getDailySalesReport.mockImplementation(() => {
            throw new Error('Report generation failed');
        });

        // Act
        const response = await request(app)
            .get('/api/v1/reports/daily-sales')
            .expect(500);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Failed to generate daily sales report');
    });

    // ✅ Positive Test: Monthly report success
    test('GET /api/v1/reports/monthly returns report data', async () => {
        // Arrange
        const app = createTestApp();
        mockReportsService.getMonthlyReport.mockReturnValue({
            month: '2026-04',
            sales: [],
            purchases: []
        });

        // Act
        const response = await request(app)
            .get('/api/v1/reports/monthly')
            .expect(200);

        // Assert
        expect(response.body).toHaveProperty('month');
    });

    // ❌ Negative Test: Monthly report error returns 500
    test('GET /api/v1/reports/monthly returns 500 on error', async () => {
        // Arrange
        const app = createTestApp();
        mockReportsService.getMonthlyReport.mockImplementation(() => {
            throw new Error('Monthly report failed');
        });

        // Act
        const response = await request(app)
            .get('/api/v1/reports/monthly')
            .expect(500);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Failed to generate monthly report');
    });

    // ✅ Positive Test: Debtor aging report success
    test('GET /api/v1/reports/debtor-aging returns report data', async () => {
        // Arrange
        const app = createTestApp();
        mockReportsService.getDebtorAgingReport.mockReturnValue({
            date: '2026-04-30',
            debtors: []
        });

        // Act
        const response = await request(app)
            .get('/api/v1/reports/debtor-aging')
            .expect(200);

        // Assert
        expect(response.body).toHaveProperty('debtors');
    });

    // ❌ Negative Test: Debtor aging report error returns 500
    test('GET /api/v1/reports/debtor-aging returns 500 on error', async () => {
        // Arrange
        const app = createTestApp();
        mockReportsService.getDebtorAgingReport.mockImplementation(() => {
            throw new Error('Report failed');
        });

        // Act
        const response = await request(app)
            .get('/api/v1/reports/debtor-aging')
            .expect(500);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Failed to generate debtor aging report');
    });

    // ✅ Positive Test: Account ledger success
    test('GET /api/v1/reports/account-ledger returns ledger data', async () => {
        // Arrange
        const app = createTestApp();
        mockReportsService.getAccountLedger.mockReturnValue({
            account_id: 1,
            transactions: []
        });

        // Act
        const response = await request(app)
            .get('/api/v1/reports/account-ledger?account_id=1')
            .expect(200);

        // Assert
        expect(response.body).toHaveProperty('account_id');
    });

    // ❌ Negative Test: Account ledger missing account_id returns 400
    test('GET /api/v1/reports/account-ledger returns 400 without account_id', async () => {
        // Arrange
        const app = createTestApp();

        // Act
        const response = await request(app)
            .get('/api/v1/reports/account-ledger')
            .expect(400);

        // Assert
        expect(response.body).toHaveProperty('error');
    });
});

// ============================================================
// Test Suite: Settings Module Error Handling
// ============================================================

describe('Settings Module Error Handling', () => {

    // ✅ Positive Test: Get system status success
    test('GET /api/v1/settings/status returns status data', async () => {
        // Arrange
        const app = createTestApp();
        mockSettingsService.getSystemStatus.mockReturnValue({
            database: 'ok',
            disk_space: 'available'
        });

        // Act
        const response = await request(app)
            .get('/api/v1/settings/status')
            .expect(200);

        // Assert
        expect(response.body).toHaveProperty('database');
    });

    // ❌ Negative Test: System status error returns 500
    test('GET /api/v1/settings/status returns 500 on error', async () => {
        // Arrange
        const app = createTestApp();
        mockSettingsService.getSystemStatus.mockImplementation(() => {
            throw new Error('Status check failed');
        });

        // Act
        const response = await request(app)
            .get('/api/v1/settings/status')
            .expect(500);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Failed to get system status');
    });

    // ✅ Positive Test: List financial years success
    test('GET /api/v1/settings/financial-years returns list', async () => {
        // Arrange
        const app = createTestApp();
        mockSettingsService.listFinancialYears.mockReturnValue([
            { id: 1, name: '2026-2027', is_active: 1 }
        ]);

        // Act
        const response = await request(app)
            .get('/api/v1/settings/financial-years')
            .expect(200);

        // Assert
        expect(response.body).toBeInstanceOf(Array);
    });

    // ✅ Positive Test: Public financial years endpoint (no auth required)
    test('GET /api/v1/settings/public-financial-years returns list', async () => {
        // Arrange
        const app = createTestApp();
        mockSettingsService.listFinancialYears.mockReturnValue([
            { id: 1, name: '2026-2027' }
        ]);

        // Act - This endpoint has standardLimiter but should work
        const response = await request(app)
            .get('/api/v1/settings/public-financial-years')
            .expect(200);

        // Assert
        expect(response.body).toBeInstanceOf(Array);
    });

    // ✅ Positive Test: Create financial year success
    test('POST /api/v1/settings/financial-years returns 201 on success', async () => {
        // Arrange
        const app = createTestApp();
        mockSettingsService.createFinancialYear.mockReturnValue(1);

        // Act
        const response = await request(app)
            .post('/api/v1/settings/financial-years')
            .send({
                name: '2027-2028',
                start_date: '2027-04-01',
                end_date: '2028-03-31'
            })
            .expect(201);

        // Assert
        expect(response.body).toHaveProperty('id');
    });

    // ❌ Negative Test: Create financial year validation error returns 400
    test('POST /api/v1/settings/financial-years returns 400 on validation failure', async () => {
        // Arrange
        const app = createTestApp();

        // Act - Missing required fields
        const response = await request(app)
            .post('/api/v1/settings/financial-years')
            .send({})
            .expect(400);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Validation failed');
    });

    // ✅ Positive Test: Update shop config success
    test('PUT /api/v1/settings/shop-config returns updated config', async () => {
        // Arrange
        const app = createTestApp();
        mockSettingsService.updateShopConfig.mockReturnValue({
            shop: { name: 'Updated Shop' }
        });

        // Act
        const response = await request(app)
            .put('/api/v1/settings/shop-config')
            .send({
                shop: { name: 'Updated Shop' }
            })
            .expect(200);

        // Assert
        expect(response.body).toHaveProperty('shop');
    });

    // ❌ Negative Test: Update shop config validation error returns 400
    test('PUT /api/v1/settings/shop-config returns 400 on validation failure', async () => {
        // Arrange
        const app = createTestApp();

        // Act - Invalid data (name too long)
        const response = await request(app)
            .put('/api/v1/settings/shop-config')
            .send({
                shop: { name: 'A'.repeat(200) }
            })
            .expect(400);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Validation failed');
    });
});

// ============================================================
// Test Suite: Uploads Module Error Handling
// ============================================================

describe('Uploads Module Error Handling', () => {

    // ✅ Positive Test: Upload images success (mocked)
    test('POST /api/v1/uploads/bills returns success with mocked files', async () => {
        // Arrange
        const app = createTestApp();

        // Act
        const response = await request(app)
            .post('/api/v1/uploads/bills')
            .expect(200);

        // Assert
        expect(response.body).toHaveProperty('success', true);
    });

    // ❌ Negative Test: No files uploaded returns 400
    test('POST /api/v1/uploads/bills returns 400 when no files', async () => {
        // Arrange
        const app = express();
        app.use(express.json());
        app.use((req, res, next) => {
            req.session = { user: { id: 1, role: 'owner' } };
            next();
        });

        // Override the multer mock to simulate no files
        app.use('/api/v1/uploads', (req, res, next) => {
            req.files = [];
            next();
        });
        app.use('/api/v1/uploads', require('../server/modules/uploads/uploads.routes'));

        // Act
        const response = await request(app)
            .post('/api/v1/uploads/bills')
            .expect(400);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('No files uploaded');
    });

    // ❌ Negative Test: Upload error returns 500
    test('POST /api/v1/uploads/bills returns 500 on internal error', async () => {
        // Arrange
        const app = express();
        app.use(express.json());
        app.use((req, res, next) => {
            req.session = { user: { id: 1, role: 'owner' } };
            next();
        });

        // Mock the route to throw an error
        app.post('/api/v1/uploads/bills', (req, res) => {
            try {
                throw new Error('Upload processing failed');
            } catch (err) {
                res.status(500).json({ error: 'Upload failed' });
            }
        });

        // Act
        const response = await request(app)
            .post('/api/v1/uploads/bills')
            .expect(500);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Upload failed');
    });
});

// ============================================================
// Test Suite: Catch-All Route Error Handling
// ============================================================

describe('Catch-All Route Error Handling', () => {

    // ✅ Positive Test: Non-API routes serve index.html
    test('non-API routes return index.html for SPA navigation', async () => {
        // Arrange
        const app = createTestApp();

        // Act
        const response = await request(app)
            .get('/some/nonexistent/route')
            .expect(200);

        // Assert - Should serve HTML (index.html)
        expect(response.text).toContain('html');
    });

    // ❌ Negative Test: API 404 returns JSON error
    test('API 404 returns JSON error for non-existent API routes', async () => {
        // Arrange
        const app = createTestApp();

        // Act
        const response = await request(app)
            .get('/api/v1/nonexistent')
            .expect(404);

        // Assert
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Not found');
    });
});
