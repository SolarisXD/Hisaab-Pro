/**
 * Jest Configuration — Hisaab Pro
 * 
 * Testing framework configuration for input validation and WAL mode tests.
 */

module.exports = {
    testEnvironment: 'node',
    coverageProvider: 'v8',
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverageFrom: [
        'server/shared/validation.js',
        'server/shared/fy-validator.js',
        'server/db/database.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'html', 'lcov'],
    verbose: true,
    setupFilesAfterEnv: [],
    modulePathIgnorePatterns: ['<rootDir>/Hisaab-Pro-v1.0.2/'],
    testPathIgnorePatterns: ['/node_modules/', '/Hisaab-Pro-v1.0.2/']
};
