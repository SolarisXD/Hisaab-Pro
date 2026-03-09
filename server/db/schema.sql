-- Hisaab Pro Database Schema
-- SQLite (better-sqlite3) — v1 plain, v3 will use SQLCipher

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    password_hash TEXT  NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'owner',   -- owner | cashier | accountant
    is_decoy    INTEGER NOT NULL DEFAULT 0,         -- 0 = real user, 1 = decoy user
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================
-- ACCOUNTS (Chart of Accounts)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    type            TEXT    NOT NULL,  -- customer | supplier | cash | bank | expense | revenue
    phone           TEXT,
    address         TEXT,
    opening_balance REAL    NOT NULL DEFAULT 0,
    current_balance REAL    NOT NULL DEFAULT 0,
    account_group   TEXT,                       -- Sundry Debtors, Sundry Creditors, Cash-in-hand, etc.
    notes           TEXT,
    is_decoy        INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================
-- SALES
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no          TEXT    NOT NULL UNIQUE,
    date                TEXT    NOT NULL,
    customer_account_id INTEGER,
    subtotal            REAL    NOT NULL DEFAULT 0,
    tax_percent         REAL    NOT NULL DEFAULT 18,
    tax_amount          REAL    NOT NULL DEFAULT 0,
    discount            REAL    NOT NULL DEFAULT 0,
    total               REAL    NOT NULL DEFAULT 0,
    amount_paid         REAL    NOT NULL DEFAULT 0,
    status              TEXT    NOT NULL DEFAULT 'pending',  -- paid | pending | partial
    ref_no              TEXT,                                -- Reference to physical book (e.g. 01-01)
    notes               TEXT,
    is_decoy            INTEGER NOT NULL DEFAULT 0,
    is_deleted          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (customer_account_id) REFERENCES accounts(id)
);

-- ============================================================
-- PURCHASES
-- ============================================================
CREATE TABLE IF NOT EXISTS purchases (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no          TEXT    NOT NULL,
    date                TEXT    NOT NULL,
    supplier_account_id INTEGER,
    total               REAL    NOT NULL DEFAULT 0,
    amount_paid         REAL    NOT NULL DEFAULT 0,
    status              TEXT    NOT NULL DEFAULT 'pending',
    ref_no              TEXT,
    notes               TEXT,
    is_decoy            INTEGER NOT NULL DEFAULT 0,
    is_deleted          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (supplier_account_id) REFERENCES accounts(id)
);

-- ============================================================
-- SALES ITEMS (Line items for each sale)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id     INTEGER NOT NULL,
    item_name   TEXT    NOT NULL,
    description TEXT,
    qty         REAL    NOT NULL DEFAULT 1,
    rate        REAL    NOT NULL DEFAULT 0,
    amount      REAL    NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT    NOT NULL,
    account_id  INTEGER NOT NULL,
    amount      REAL    NOT NULL,
    type        TEXT    NOT NULL,      -- in | out
    mode        TEXT    NOT NULL DEFAULT 'cash',
    reference   TEXT,                  -- cheque number, UPI ID, etc.
    ref_no      TEXT,                  -- Book reference
    sale_id     INTEGER,               -- link to sale if applicable
    purchase_id INTEGER,               -- link to purchase
    notes       TEXT,
    is_decoy    INTEGER NOT NULL DEFAULT 0,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (purchase_id) REFERENCES purchases(id)
);

-- ============================================================
-- TRANSACTIONS (Double-entry style ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    date                TEXT    NOT NULL,
    account_id          INTEGER NOT NULL,
    type                TEXT    NOT NULL,    -- debit | credit
    amount              REAL    NOT NULL,
    description         TEXT,
    is_decoy            INTEGER NOT NULL DEFAULT 0,
    linked_sale_id      INTEGER,
    linked_purchase_id  INTEGER,
    linked_payment_id   INTEGER,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (linked_sale_id) REFERENCES sales(id),
    FOREIGN KEY (linked_purchase_id) REFERENCES purchases(id),
    FOREIGN KEY (linked_payment_id) REFERENCES payments(id)
);

-- ============================================================
-- ACTIVITY LOG (Audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    user_id     INTEGER,
    action      TEXT    NOT NULL,   -- login | logout | create_sale | edit_sale | delete_sale | etc.
    entity_type TEXT,               -- sale | payment | account | user
    entity_id   INTEGER,
    details     TEXT,               -- JSON string with additional info
    ip_address  TEXT,
    is_decoy    INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================================
-- SYNC SESSIONS (Device management for LAN sync)
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   TEXT    NOT NULL UNIQUE,
    device_name TEXT    NOT NULL,
    last_sync   TEXT,
    approved    INTEGER NOT NULL DEFAULT 0,
    revoked     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================
-- SECURITY STATE (Failed logins and auto-wipe)
-- ============================================================
CREATE TABLE IF NOT EXISTS security_state (
    id              INTEGER PRIMARY KEY CHECK (id = 1), -- Singleton record
    failed_logins   INTEGER NOT NULL DEFAULT 0,
    last_failure_at TEXT,
    is_nuked        INTEGER NOT NULL DEFAULT 0,         -- 1 = data has been wiped
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Initialize the singleton record
INSERT OR IGNORE INTO security_state (id, failed_logins, is_nuked) VALUES (1, 0, 0);

-- ============================================================
-- FINANCIAL YEARS
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_years (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE, -- e.g. 2023-24
    start_date  TEXT    NOT NULL,
    end_date    TEXT    NOT NULL,
    is_active   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================
-- SYSTEM SETTINGS (Book refs, billing etc)
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
    key         TEXT    PRIMARY KEY,
    value       TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

INSERT OR IGNORE INTO system_settings (key, value) VALUES ('current_book_no', '01');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('current_page_no', '01');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('fy_active', '');

-- ============================================================
-- INDEXES for query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_no);

CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
CREATE INDEX IF NOT EXISTS idx_payments_account ON payments(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);

CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
