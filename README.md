# Hisaab Pro -- Professional Business Ledger System

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/yourusername/hisaab-pro)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14-brightgreen)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/database-SQLite-003B57)](https://www.sqlite.org/)
[![Offline First](https://img.shields.io/badge/offline-first-orange)](https://offlinefirst.org/)
[![Security](https://img.shields.io/badge/encryption-AES256-purple)](https://en.wikipedia.org/wiki/AES_256)

**Hisaab Pro** is a professional-grade, local-first business ledger system designed for small to medium retail businesses. Built with security and performance in mind, it operates entirely offline on Windows platforms (Windows 7+ optimized) with encrypted SQLite storage, providing instant response times without internet dependency or cloud subscriptions.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Core Modules](#core-modules)
- [Security Features](#security-features)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Testing](#testing)
- [License](#license)

---

## Overview

Hisaab Pro addresses the critical need for reliable, secure, and fast business accounting software that works without internet connectivity. Perfect for retail shops, small businesses, and enterprises requiring:

- **Complete Data Privacy** -- All data stays on your local machine
- **Professional Accounting** -- Double-entry bookkeeping with comprehensive reporting
- **Staff Management** -- Integrated payroll and attendance tracking
- **Multi-FY Support** -- Seamless financial year switching with isolated databases
- **Enterprise Security** -- Database encryption with automatic threat response
- **USB Portability** -- Run directly from USB drives with WAL mode reliability

---

## Key Features

### Dashboard and Analytics
- **Real-time Overview**: Sales metrics, outstanding balances, cash/bank positions
- **Interactive Charts**: Visual revenue trends and expense analysis (Chart.js)
- **Quick Actions**: Fast access to common tasks and recent transactions

### Financial Management
- **Sales Management**: Complete invoicing with tax calculation (GST ready), itemized bills, payment tracking
- **Purchase Tracking**: Supplier management with purchase orders and payment status
- **Payment Processing**: Incoming/outgoing payments with multiple modes (Cash, Bank, UPI, Cheque)
- **Multi-Currency Support**: Configurable currency with locale-based formatting (INR optimized)

### Accounting System
- **Chart of Accounts**: Dynamic account types (Customer, Supplier, Cash, Bank, Expense, Revenue, Staff)
- **Double-Entry Ledger**: Automatic transaction recording for all financial activities
- **Account Statements**: Detailed transaction history with running balances
- **Account Groups**: Organized grouping (Sundry Debtors, Sundry Creditors, etc.)

### Staff and Payroll Module
- **Employee Management**: Staff profiles with salary/wage configuration
- **Attendance Tracking**: Daily attendance with present/absent/half-day/leave status
- **Automated Payroll**: Salary calculation based on attendance and configured wages
- **Staff Accounts**: Integrated staff ledger with payment history

### Financial Reports
- **Daily Sales Reports**: Transaction-level daily business summary
- **Monthly Revenue**: Period-wise revenue analysis with comparisons
- **Debtor Aging Analysis**: Outstanding receivable aging buckets
- **Creditor Schedule**: Payable aging and supplier balance reports
- **Balance Sheet**: Complete financial position statement
- **Profit and Loss**: Income statement with expense breakdown

### Security and Encryption
- **Database Encryption**: AES-256 encryption for all SQLite databases
- **Session Management**: Secure HTTP-only session cookies with configurable timeouts
- **Rate Limiting**: API protection against brute-force attacks
- **Audit Trail**: Complete activity logging for compliance
- **Auto-Wipe Protection**: Configurable failed login attempt response
- **Decoy Data**: Support for plausible deniability with decoy records

### Data Management
- **Financial Year Isolation**: Each FY maintains a separate encrypted database
- **Instant FY Switching**: Context-aware database switching without restart
- **Automated Backups**: Scheduled backups with USB drive support
- **Data Export**: PDF invoices and reports with professional formatting
- **Bill Scanning**: Upload and link bill images to transactions

### User Experience
- **Modern UI**: Material Design 3 with Tailwind CSS
- **Responsive Design**: Works on desktops, tablets, and large screens
- **Keyboard Shortcuts**: Power-user features for fast data entry
- **Print-Ready**: A4 optimized invoices and reports
- **Theme Support**: Light/dark mode with customizable color schemes

---

## Tech Stack

### Backend
- **Runtime**: Node.js (v14+ supported, v18 LTS recommended)
- **Framework**: Express.js with modular routing
- **Database**: SQLite with `better-sqlite3-multiple-ciphers` (AES-256 encryption, WAL mode)
- **Authentication**: bcryptjs with session-based auth
- **Security**: Helmet.js, CORS, express-rate-limit

### Frontend
- **Core**: Vanilla JavaScript (ES6+) -- No heavy frameworks
- **Styling**: Tailwind CSS with custom design system
- **Icons**: Material Symbols Outlined
- **Typography**: Inter and Manrope font families
- **Charts**: Chart.js for analytics visualization
- **PDF Generation**: jsPDF + html2canvas

### Development Tools
- **Hot Reload**: Nodemon for development
- **Validation**: Zod for schema validation
- **Logging**: Custom logger with rotation support
- **Testing**: Jest with 439 tests across 18 test files

---

## Quick Start

### Prerequisites
- **Node.js**: Version 14.x to 19.x (18.x LTS recommended)
- **Operating System**: Windows 7, 10, or 11 (optimized for Windows)
- **RAM**: 2GB minimum (4GB recommended)
- **Storage**: 500MB free space (plus data storage)

### Installation

1. **Extract** the project to your desired location
   ```bash
   # Example: C:\HisaabPro\
   ```

2. **Install Dependencies**:
   ```bash
   cd HisaabPro
   npm install
   ```

3. **Configure Your Shop** (Optional):
   Edit `config.json` to set your shop details:
   ```json
   {
     "shop": {
       "name": "Your Shop Name",
       "address": "Your Address",
       "phone": "+91-XXXXXXXXXX",
       "gstin": "YOUR_GSTIN"
     },
     "currency": "INR",
     "tax_rate": 18
   }
   ```

4. **Seed Database** (Optional - for demo/testing):
   ```bash
   npm run seed
   ```
   This creates sample data for testing all features.

5. **Start the Server**:
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

6. **Access the Application**:
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
   Chrome/Chromium recommended for best experience.

### Windows Startup Script

For USB-based deployment, use the included `start.bat` script:
- Double-click `start.bat` to start the application
- The script automatically starts the server and opens the browser
- Handles port conflicts gracefully

### Default Credentials

**Important**: Change these immediately after first login
- **Username**: `admin`
- **Password**: `admin123`

---

## Project Structure

```
hisaab-pro/
├── client/                    # Frontend assets
│   ├── index.html            # Login page
│   ├── signup.html           # User registration
│   ├── dashboard.html        # Main dashboard
│   ├── sales.html            # Sales management
│   ├── purchases.html        # Purchase management
│   ├── payments.html         # Payment tracking
│   ├── accounts.html         # Chart of accounts
│   ├── staff.html            # Staff and payroll
│   ├── reports.html          # Financial reports
│   ├── settings.html         # Configuration
│   ├── css/                  # Stylesheets
│   │   ├── style.css         # Main stylesheet
│   │   └── print.css         # Print optimizations
│   ├── js/                   # JavaScript modules
│   │   ├── api.js            # API client
│   │   ├── auth.js           # Authentication
│   │   ├── dashboard.js      # Dashboard logic
│   │   ├── sales.js          # Sales module
│   │   ├── purchases.js      # Purchases module
│   │   ├── payments.js       # Payments module
│   │   ├── accounts.js       # Accounts module
│   │   ├── staff.js          # Staff management
│   │   ├── reports.js        # Reports generation
│   │   ├── settings.js       # Settings management
│   │   ├── pdf.js            # PDF export utilities
│   │   ├── shortcuts.js      # Keyboard shortcuts
│   │   ├── tailwind-config.js# Tailwind configuration
│   │   └── utils.js          # Shared utilities
│   └── assets/               # Static assets
│       ├── logo.png          # Shop logo
│       ├── chart.min.js      # Chart.js library
│       ├── jspdf.umd.min.js  # jsPDF library
│       └── html2canvas.min.js # html2canvas library

├── server/                    # Backend application
│   ├── index.js              # Express server entry point
│   ├── config.js             # Configuration loader
│   ├── db/                   # Database layer
│   │   ├── database.js      # Database adapter with encryption and WAL mode
│   │   ├── schema.sql       # Complete database schema
│   │   └── seed.js          # Demo data generator
│   ├── modules/              # Feature modules (9 modules)
│   │   ├── auth/            # Authentication and authorization
│   │   ├── dashboard/       # Dashboard analytics
│   │   ├── sales/           # Sales management
│   │   ├── purchases/       # Purchase management
│   │   ├── payments/        # Payment processing
│   │   ├── accounts/        # Chart of accounts
│   │   ├── staff/           # Staff and payroll
│   │   ├── reports/         # Financial reporting
│   │   ├── settings/        # Settings management
│   │   └── uploads/         # File upload handling
│   └── shared/               # Shared utilities
│       ├── logger.js         # Logging system
│       ├── validation.js     # Input validation (Zod schemas)
│       ├── rate-limiter.js   # API rate limiting
│       ├── paths.js          # Path resolution
│       ├── fy-validator.js  # Financial year validation
│       ├── roles.js          # Role-based access control
│       └── utils.js          # Shared utilities

├── scripts/                   # Utility scripts
│   ├── backup.js            # Automated backup system
│   ├── migrate.js           # Database migrations
│   ├── verify_security.js   # Security verification
│   ├── add-staff-link.js    # Utility script
│   ├── download_assets.js   # Asset downloader
│   └── tests/               # Test scripts

├── tests/                     # Test suite (18 test files, 439 tests)
│   ├── double-entry.test.js            # Accounting integrity
│   ├── wal-mode.test.js                # WAL mode verification
│   ├── atomic-writes.test.js           # Data safety
│   ├── crash-simulation.test.js        # Crash recovery
│   ├── full-restore.test.js            # Restore functionality
│   ├── account-creation.test.js        # Account workflows
│   ├── transaction-addition.test.js    # Transaction workflows
│   ├── input-validation.test.js        # Zod validation
│   ├── duplicate-payroll.test.js       # Payroll prevention
│   ├── broken-references.test.js       # FK constraints
│   ├── cross-pc-compat.test.js         # USB compatibility
│   ├── drive-letters.test.js           # Drive letter handling
│   ├── no-absolute-paths.test.js       # Path safety
│   ├── usb-removal.test.js             # Crash recovery
│   ├── usb-removal-integration.test.js # Integration tests
│   ├── usb-performance.test.js         # Performance testing
│   ├── error-logging.test.js           # Logging verification
│   └── no-silent-failures.test.js      # Error handling

├── data/                      # Data directory (created at runtime)
│   ├── hisaab.db            # Active database (encrypted)
│   ├── uploads/             # Uploaded bill images
│   └── backups/             # Automated backups

├── logs/                      # Log files (created at runtime)
│   └── app.log              # Application logs

├── Docs/                      # Documentation
│   ├── prd.md               # Product requirements
│   ├── implementation_plan.md# Implementation details
│   ├── pre-launch-security-guide.md
│   ├── FINAL_LAUNCH_CHECKLIST.md
│   └── USB_PRODUCT_ROADMAP.md

├── website/                   # Distribution website
│   └── index.html          # Landing page

├── config.json                # Runtime configuration
├── config.example.json        # Configuration template
├── package.json               # Node.js dependencies
├── jest.config.js             # Jest configuration
├── nodemon.json               # Nodemon configuration
├── start.bat                  # Windows startup script
├── CHANGELOG.md               # Version history
├── LICENSE                    # MIT License
├── CLIENT_LICENSE.md          # Commercial deployment terms
└── README.md                  # This file
```

---

## Core Modules

### 1. Authentication Module (`/api/v1/auth`)
- Secure login with bcrypt password hashing
- Session-based authentication with configurable timeouts
- Role-based access control (owner, cashier, accountant)
- Failed login tracking with auto-wipe protection
- Decoy user support for enhanced privacy

### 2. Dashboard Module (`/api/v1/dashboard`)
- Real-time business metrics
- Sales trends and analytics
- Outstanding receivables/payables
- Cash flow summary
- Low stock alerts (if inventory module added)

### 3. Sales Module (`/api/v1/sales`)
- Create and manage invoices
- Itemized billing with descriptions
- Tax calculation (GST compliant)
- Payment status tracking (paid/pending/partial)
- Invoice PDF generation
- Bill image attachment
- Sales return handling

### 4. Purchases Module (`/api/v1/purchases`)
- Supplier purchase orders
- Invoice tracking from suppliers
- Payment status management
- Tax calculation on purchases
- Purchase PDF generation
- Bill image attachment
- Purchase return handling

### 5. Payments Module (`/api/v1/payments`)
- Record incoming payments (from customers)
- Record outgoing payments (to suppliers)
- Multiple payment modes (Cash, Bank, UPI, Cheque)
- Payment reconciliation
- Payment reminders and scheduling
- Linked transaction support

### 6. Accounts Module (`/api/v1/accounts`)
- Dynamic chart of accounts
- Account types: Customer, Supplier, Cash, Bank, Expense, Revenue, Staff
- Account groups for better organization
- Opening balance management
- Transaction history with running balance
- Account statement generation
- Soft delete with audit trail

### 7. Staff and Payroll Module (`/api/v1/staff`)
- Staff profile management
- Monthly salary / daily wage configuration
- Daily attendance marking (present/absent/half-day/leave)
- Automated payroll calculation
- Salary payment tracking
- Staff ledger integration
- Attendance reports

### 8. Reports Module (`/api/v1/reports`)
- Daily sales summary
- Monthly revenue reports
- Debtor aging analysis (30/60/90+ days)
- Creditor aging schedule
- Balance sheet
- Profit and loss statement
- Cash flow statement
- Custom date range reports

### 9. Settings Module (`/api/v1/settings`)
- Shop information management
- Financial year creation and switching
- Invoice prefix and numbering
- Tax rate configuration
- User management (add/remove users)
- Database backup/restore
- System preferences

### 10. File Uploads Module (`/api/v1/uploads`)
- Secure bill image uploads
- Support for multiple image formats
- Automatic file organization
- Protected by authentication
- Linked to transactions

---

## Security Features

### Database Encryption
- **AES-256 Encryption**: All SQLite databases are encrypted using `better-sqlite3-multiple-ciphers`
- **Per-Database Keys**: Each financial year database uses encrypted storage
- **WAL Mode**: Write-Ahead Logging enabled for crash recovery and USB reliability
- **Key Management**: Encryption keys stored securely in `config.json`

### Application Security
- **Helmet.js**: Security headers to prevent common attacks (XSS, MIME sniffing, etc.)
- **Rate Limiting**: API rate limiting (100 requests per 15 minutes per IP)
- **CORS Protection**: Restricted to localhost only (configurable for LAN)
- **Session Security**: HTTP-only cookies with SameSite protection
- **Input Validation**: Zod schema validation on all inputs
- **SQL Injection Protection**: Parameterized queries throughout

### Authentication and Authorization
- **Password Hashing**: bcrypt with salt rounds for secure password storage
- **Session Management**: Configurable session timeout (default: 15 minutes)
- **Role-Based Access**: Three roles - owner (full access), accountant, cashier
- **Activity Logging**: Complete audit trail of all user actions

### Advanced Protection
- **Failed Login Tracking**: Configurable threshold (default: 5 attempts)
- **Auto-Wipe Capability**: Optional data wipe after excessive failed attempts
- **Decoy Data Support**: Plausible deniability with decoy records
- **Path Traversal Protection**: Strict validation of all file paths and FY headers
- **No External Dependencies**: Works completely offline - no data leaves your machine
- **USB Reliability**: WAL mode ensures data integrity even with unsafe removal

---

## Configuration

### config.json Structure

```json
{
  "shop": {
    "name": "Your Shop Name",
    "address": "Shop Address",
    "phone": "+91-XXXXXXXXXX",
    "gstin": "YOUR_GSTIN_HERE",
    "logo_path": "assets/logo.png"
  },
  "currency": "INR",
  "currency_symbol": "₹",
  "tax_rate": 18,
  "invoice_prefix": "INV",
  "locale": "hi-IN",
  "session": {
    "timeout_minutes": 15
  },
  "backup": {
    "auto_time": "23:00",
    "usb_drive_label": "HISAABPRO_BKP"
  },
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "database": {
    "path": "./data/hisaab.db"
  },
  "financial_years": []
}
```

### Configuration Options

| Section | Key | Description | Default |
|---------|-----|-------------|---------|
| **shop** | name | Your business name | Required |
| | address | Business address | Required |
| | phone | Contact number | Required |
| | gstin | GST Identification Number | Optional |
| | logo_path | Path to shop logo | assets/logo.png |
| **currency** | currency | Currency code (INR, USD, etc.) | INR |
| | currency_symbol | Symbol to display (₹, $, etc.) | ₹ |
| | tax_rate | Default tax percentage | 18 |
| | invoice_prefix | Prefix for invoice numbers | INV |
| | locale | Locale for number/date formatting | hi-IN |
| **session** | timeout_minutes | Session timeout duration | 15 |
| **backup** | auto_time | Daily backup time (24h format) | 23:00 |
| | usb_drive_label | USB drive label for backups | HISAABPRO_BKP |
| **server** | port | Port to run the server | 3000 |
| | host | Host address (localhost for local) | localhost |
| **database** | path | Base path for database files | ./data/hisaab.db |

---

## API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
All API requests (except `/auth/login`) require:
- Valid session cookie
- `x-financial-year` header with the target database filename

### Common Headers
```
Content-Type: application/json
x-financial-year: hisaab_2026_27_1234567890.db
```

### Key Endpoints

#### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/verify` - Verify session

#### Sales
- `GET /sales` - List all sales
- `POST /sales` - Create new sale
- `GET /sales/:id` - Get sale details
- `PUT /sales/:id` - Update sale
- `DELETE /sales/:id` - Delete sale (soft delete)

#### Purchases
- `GET /purchases` - List all purchases
- `POST /purchases` - Create new purchase
- `GET /purchases/:id` - Get purchase details
- `PUT /purchases/:id` - Update purchase
- `DELETE /purchases/:id` - Delete purchase

#### Payments
- `GET /payments` - List all payments
- `POST /payments` - Record new payment
- `GET /payments/:id` - Get payment details
- `PUT /payments/:id` - Update payment
- `DELETE /payments/:id` - Delete payment

#### Accounts
- `GET /accounts` - List all accounts
- `POST /accounts` - Create new account
- `GET /accounts/:id` - Get account details
- `GET /accounts/:id/statement` - Get account statement
- `PUT /accounts/:id` - Update account
- `DELETE /accounts/:id` - Delete account

#### Staff
- `GET /staff` - List all staff
- `POST /staff` - Add new staff member
- `GET /staff/:id/attendance` - Get attendance records
- `POST /staff/:id/attendance` - Mark attendance
- `POST /staff/:id/payroll` - Generate payroll

#### Reports
- `GET /reports/daily-sales` - Daily sales report
- `GET /reports/monthly-revenue` - Monthly revenue report
- `GET /reports/debtor-aging` - Debtor aging analysis
- `GET /reports/creditor-aging` - Creditor aging analysis
- `GET /reports/balance-sheet` - Balance sheet
- `GET /reports/profit-loss` - Profit and loss statement

#### Dashboard
- `GET /dashboard/summary` - Dashboard metrics
- `GET /dashboard/recent-transactions` - Recent activity
- `GET /dashboard/charts` - Chart data

---

## Development

### Running in Development Mode
```bash
npm run dev
```
This uses nodemon to auto-restart on file changes.

### Database Management
```bash
# Reset database (caution: deletes all data)
rm data/*.db

# Seed with demo data
npm run seed

# Run with demo data
npm run demo
```

### Adding a New Financial Year
1. Go to Settings page
2. Click "Add Financial Year"
3. Enter start and end dates
4. New encrypted database will be created automatically
5. Switch between FYs using the dropdown in the header

### Backup and Restore
- **Automatic**: Backups run daily at configured time
- **Manual**: Use the backup button in Settings
- **USB Backup**: Insert USB with label "HISAABPRO_BKP"
- **Restore**: Copy backup `.db` file to `data/` directory

---

## Testing

Hisaab Pro includes a comprehensive test suite with **439 tests** across **18 test files**, covering all critical functionality.

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Categories

#### Accounting Integrity
- `double-entry.test.js` - Verifies debit=credit enforcement, trial balance = 0
- `transaction-addition.test.js` - Tests all transaction types and ledger consistency

#### Data Safety (Critical for USB Model)
- `wal-mode.test.js` - Verifies WAL mode is enabled for crash recovery
- `atomic-writes.test.js` - Ensures no partial commits
- `crash-simulation.test.js` - Simulates crashes during writes
- `full-restore.test.js` - Tests backup and restore functionality

#### Input Validation and Constraints
- `input-validation.test.js` - Zod schema validation (45 tests)
- `duplicate-payroll.test.js` - Prevents duplicate payroll entries
- `broken-references.test.js` - Handles broken FK references

#### USB-Specific Reliability
- `cross-pc-compat.test.js` - Tests across different Windows PCs (40 tests)
- `drive-letters.test.js` - Handles D:, E:, F: drive letters
- `no-absolute-paths.test.js` - Ensures no absolute path dependencies
- `usb-removal.test.js` - Handles unsafe USB removal
- `usb-performance.test.js` - Performance on slow USB drives
- `usb-removal-integration.test.js` - Integration tests for USB scenarios

#### Logging and Error Handling
- `error-logging.test.js` - Verifies all errors are logged (29 tests)
- `no-silent-failures.test.js` - Ensures no silent failures (26 tests)

#### Core Workflows
- `account-creation.test.js` - Account creation workflows
- `transaction-addition.test.js` - Transaction addition workflows

### Test Coverage
- **Total Test Files**: 18
- **Total Test Cases**: 439
- **Test Code**: 16,000+ lines
- **Coverage Reports**: Generated in `coverage/` directory

---

## License

### Base System
This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Commercial Deployments
For client-specific deployments, please refer to [CLIENT_LICENSE.md](CLIENT_LICENSE.md) for commercial licensing terms, which include:
- Single installation per license
- Permission to modify CSS and reports
- Prohibition on resale or SaaS conversion
- Attribution requirement ("Powered by Hisaab Pro")

---

## Support and Contact

For technical support, feature requests, or commercial licensing inquiries:

- **Issues**: Use the GitHub issue tracker
- **Documentation**: See the `Docs/` directory for detailed guides
- **Security**: Review `Docs/pre-launch-security-guide.md` for security best practices

---

## Acknowledgments

- **SQLite** team for the robust embedded database
- **Tailwind CSS** for the utility-first CSS framework
- **Material Design** for the icon system and design language
- **Node.js** community for the excellent ecosystem
- **Jest** testing framework for reliable test infrastructure

---

## First-Run Setup Wizard

When a business uses Hisaab Pro for the first time, a **Setup Wizard** automatically launches to configure the system. This ensures a clean, professional first experience without any test or demo data.

### What the Setup Wizard Configures

1. **Admin Account Creation**
   - Create a secure admin username and password
   - Password strength validation with visual feedback
   - Confirmation to prevent typos

2. **Shop Information**
   - Business name (required)
   - Complete address
   - Contact phone number
   - GSTIN (optional, with format validation)

3. **Financial Year Setup**
   - Define your first financial year (e.g., 2026-27)
   - Set start and end dates
   - Defaults to Indian financial year (April 1 to March 31)

4. **Currency and Tax Settings**
   - Select currency (INR, USD, EUR, GBP)
   - Set currency symbol
   - Configure default tax rate (GST ready)
   - Customize invoice prefix
   - Choose locale for formatting

### How It Works

- **Automatic Detection**: System detects first run by checking if any users exist
- **Seamless Redirect**: Unauthenticated users are redirected to `/setup.html`
- **One-Time Process**: Setup runs only once; subsequent accesses go directly to login
- **Clean Database**: No demo or test data is created -- only the admin user and account types
- **Immediate Use**: After setup, log in with your new credentials and start using the system

### For Developers

The setup wizard consists of:
- **Server Module**: `server/modules/setup/` (service and routes)
- **Client Page**: `client/setup.html` (4-step wizard)
- **API Endpoints**:
  - `GET /api/v1/setup/status` - Check if setup is required
  - `POST /api/v1/setup/complete` - Complete setup process
  - `POST /api/v1/setup/validate-shop` - Validate shop details

---

## Project Status

**Version**: V1.0.0 (Publication Ready)  
**Status**: All Phase 0 (Non-Negotiable Validation) requirements completed  
**Test Coverage**: 439 tests across 18 test files  
**Last Updated**: May 2, 2026

### Completed Features
- Core Accounting (Double-Entry) - Complete
- Sales and Purchases Management - Complete
- Staff and Payroll Module - Complete
- Financial Reports - Complete
- Security and Encryption - Complete
- PDF Export - Complete
- Multi-Financial Year Support - Complete
- USB Portability with WAL Mode - Complete
- Comprehensive Test Suite - Complete
- **First-Run Setup Wizard - Complete**

### Roadmap
- Inventory Module - Planned
- LAN Sync - Planned
- Mobile App - Planned

---

**Hisaab Pro -- Fast. Secure. Local.**

[Documentation](Docs/) | [Changelog](CHANGELOG.md) | [License](LICENSE) | [Client License](CLIENT_LICENSE.md)
