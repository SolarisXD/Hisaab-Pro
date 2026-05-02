# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-05-02 (V1 Publication Release - Setup Wizard)
### Added
- **Backend**: Express server with 9 core modules (Auth, Sales, Purchases, Payments, Accounts, Staff, Dashboard, Reports, Setup).
- **Database**: SQLite schema with WAL mode enabled for performance and USB reliability.
- **Frontend**: Responsive Vanilla JS dashboard with Flexbox-only CSS for legacy compatibility.
- **Design System**: Full CSS custom property system for easy branding.
- **Reports**: Daily sales, monthly financial, debtor aging, creditor schedule, balance sheet, P&L.
- **Exports**: PDF generation for invoices and reports via jsPDF.
- **Auth**: Secure session-based authentication with bcrypt hashing.
- **Setup Wizard**: First-run setup wizard for new businesses (admin account, shop config, financial year).
- **Seeding**: Realistic demo data script for testing.
- **Docs**: Comprehensive README with Setup Wizard documentation, MIT License, and Client License.

### Validated (V1 Readiness)
- ✅ **Accounting Integrity**: Strict double-entry (debit=credit), trial balance = 0, ledger consistency
- ✅ **Data Safety**: WAL mode, atomic writes, crash recovery, backup/restore system
- ✅ **Core Workflows**: Account creation, transactions, ledger, reports, edit/delete, FY switching
- ✅ **Input Validation**: Server-side Zod validation, invalid input prevention, duplicate payroll prevention
- ✅ **USB Reliability**: Cross-PC compatibility, drive letter handling, unsafe removal protection
- ✅ **Logging & Errors**: All errors logged to `logs/`, no silent failures, user-visible error messages
- ✅ **Test Coverage**: 179+ tests across 16 test files, all critical paths verified

### Changed
- Enhanced error logging with file-based logging to `logs/app.log`
- Improved database connection handling with WAL mode enforcement
- Added comprehensive input validation using Zod schemas

### Fixed
- Silent failures in API endpoints (now return proper error responses)
- Potential data corruption on unsafe USB removal (WAL mode protection)
- Broken reference handling (FK constraints enforced)

---

## [1.0.0-rc] - 2026-03-06
### Added
- **Backend**: Express server with 6 core modules (Auth, Sales, Payments, Accounts, Dashboard, Reports).
- **Database**: SQLite schema with WAL mode enabled for performance.
- **Frontend**: Responsive Vanilla JS dashboard with Flexbox-only CSS for legacy compatibility.
- **Design System**: Full CSS custom property system for easy branding.
- **Reports**: Daily sales, monthly financial, debtor aging, creditor schedule, and balance sheet.
- **Exports**: PDF generation for invoices and reports via jsPDF.
- **Auth**: Secure session-based authentication with bcrypt hashing.
- **Seeding**: Realistic demo data script for testing.
- **Docs**: Comprehensive README, MIT License, and Client License.
