# Product Requirements Document: Hisaab Pro

**Version:** 2.0  
**Date:** March 2026  
**Product:** Hisaab Pro — Secure Business Ledger System  
**Owner:** Personal Project (Built for family sanitary & hardware shop, Sādri, Rajasthan)  
**Showcase:** Portfolio project · GitHub open-source · Client-licensed deployments

---

## 1. Overview

Hisaab Pro is a local-first, encrypted business management system built for small retail shops. It replaces manual record-keeping with a secure, offline-capable solution that runs on both desktop (Windows) and mobile (PWA), without relying on any cloud service.

The system is designed to protect sensitive financial data from unauthorized access — including forced disclosure scenarios — while remaining practical for daily shop use.

**This project serves three purposes simultaneously:**

1. **Personal use** — A working system deployed for the developer's father's sanitary & hardware shop in Sādri, Rajasthan
2. **Portfolio showcase** — A full-stack, security-focused project demonstrating real-world engineering on GitHub and a résumé
3. **Client product** — A deployable, configurable version that can be licensed or delivered to other small shop owners as a personalized installation

---

## 2. Problem Statement

The shop owner faces a unique combination of operational and security challenges:

- Needs to track sales, customer debts, and supplier payments in real time
- Works at the shop Monday–Thursday (WiFi available) and travels to client sites Friday–Saturday (no WiFi)
- Needs mobile access to business data while fully offline in the field
- Has serious concerns about data privacy: if officials seize the computer, all business records would be exposed
- Currently lacks professional bill generation and PDF reporting for accountants

No existing off-the-shelf solution addresses all of these together: local-first operation, offline sync, and plausible-deniability encryption.

---

## 3. Compatibility Requirements

> **This is a first-class design constraint, not an afterthought.** The target users are small shop owners across India — most running old hardware, budget Android phones, and whatever Windows version came with their machine years ago. Every technology choice must be validated against these targets before adoption.

### 3.1 Desktop — Windows

| Windows Version | Support Level | Notes |
|----------------|---------------|-------|
| **Windows 7** | ✅ Full support | Primary constraint — drives all version pins below |
| **Windows 10** | ✅ Full support | Most common version among mid-range shop setups |
| **Windows 11** | ✅ Full support | Newer machines; no special handling needed |

**Version pins driven by Windows 7 support:**

| Tool | Version | Reason |
|------|---------|--------|
| **Node.js** | v18 LTS (max) | Node 20+ dropped Windows 7 support |
| **Electron** | v22 or earlier | Electron v23+ dropped Windows 7 support |
| **Python** | 3.8.x | Last Python version supporting Windows 7 |
| **Flask** | 2.x | Compatible with Python 3.8 |
| **better-sqlite3** | Use prebuilt binaries | Avoid native compile issues on old machines |

**UI / CSS constraints for Windows 7:**
- No CSS Grid subgrid, container queries, or `:has()` selector
- Stick to Flexbox for layout — fully supported in IE11-era Chromium (Electron v22 uses Chromium 108)
- Bundle all fonts locally — Windows 7 lacks modern system fonts
- Avoid ES2022+ syntax (top-level await, `?.` optional chaining) in Electron renderer — or add a minimal Babel transpile step for the desktop build only

### 3.2 Mobile — Android

| Android Version | Support Level | Notes |
|----------------|---------------|-------|
| **Android 7.0+ (Nougat)** | ✅ Full support | Covers ~95%+ of active Android devices in India |
| **Android 5 / 6** | ⚠️ Best-effort | IndexedDB and Service Worker support is inconsistent; not guaranteed |
| **iOS** | ❌ Not supported (v1) | Out of scope — Android-only for now |

**Mobile browser target:** Chrome for Android (any version shipping with Android 7+)

**Mobile constraints:**
- PWA install prompt (Add to Home Screen) works on Chrome for Android 7+
- IndexedDB available and stable on Android 7+ Chrome
- Service Worker supported on Android 7+ Chrome
- CryptoJS AES-256 runs in pure JS — no native dependencies, works on all Android versions
- Avoid CSS features not supported in Chrome 57 (ships with Android 7)
- Keep total PWA asset size under 5 MB for fast pre-load on slow connections

### 3.3 Hardware Assumptions

Since most shop owners run low-end machines, the app must perform well under these conditions:

| Spec | Assumed Minimum |
|------|----------------|
| RAM | 2 GB |
| Storage | 50 GB HDD (not SSD) |
| Processor | Dual-core, 1.6 GHz |
| Screen | 1366×768 (most common laptop resolution in India) |
| Internet | Not required — offline-first by design |
| Printer | USB or basic WiFi printer (no cloud print) |

**Performance targets under these constraints:**
- App startup (desktop): < 5 seconds on HDD
- Page load / navigation: < 1 second
- PDF generation: < 3 seconds
- Sync (weekly delta): < 30 seconds on local WiFi

---

## 4. Goals

| Goal | Description |
|------|-------------|
| **Broad compatibility** | Runs on Windows 7/10/11 and Android 7+ without modification |
| **Data security** | Protect real business data from unauthorized access, including forced disclosure scenarios |
| **Offline-first mobile** | Full access to data in the field without internet or WiFi |
| **Professional operations** | Generate GST-compliant invoices and financial reports as PDFs |
| **Zero cloud dependency** | No subscriptions, no external servers, no data exposure to third parties |
| **Sync reliability** | Auto-sync between desktop and mobile when back on home WiFi |
| **Showcase quality** | Clean, well-documented codebase suitable for GitHub portfolio and résumé |
| **Client deployability** | Config-driven setup so new clients get a personalized copy in under 3 hours |

---

## 5. Non-Goals (v1)

- No multi-user / multi-shop support
- No cloud backup or remote internet access
- No GST e-filing integration with government portals
- No inventory / stock management
- No SaaS / subscription model (v1 is a one-time licensed install)

---

## 6. Users

| User | Description |
|------|-------------|
| **Shop Owner (Client)** | Non-technical adult; primary daily user on desktop and mobile |
| **Developer** | Builder, deployer, and maintainer; also the GitHub author |
| **Future Clients** | Other small shop owners who receive a personalized installation |
| **Accountant** | Receives exported PDFs only; no direct system access |
| **GitHub Visitors / Recruiters** | View the public repo, README, and demo; evaluate technical skill |

---

## 7. Showcase & Portfolio Requirements

This section defines what makes Hisaab Pro a strong portfolio piece and a credible product for client delivery.

### 6.1 GitHub Repository (Public)

The repository must be showcase-ready from day one:

- **README.md** — Project banner, one-line description, feature highlights, screenshots/GIFs, tech stack badges, setup instructions, and a "Why I built this" section
- **Clean folder structure** — Logical separation of `client/`, `server/`, `mobile/`, `scripts/`, `docs/`
- **Commented code** — Key functions and modules documented with JSDoc-style comments
- **Demo mode** — A `--demo` flag or seed script that loads sample data so anyone cloning the repo can run it and see it working without real data
- **Changelog** — `CHANGELOG.md` tracking version history per phase
- **License** — MIT license for the open-source base; a separate `CLIENT_LICENSE.md` for personalized deployments
- **GitHub topics/tags** — `offline-first`, `sqlite`, `encryption`, `pwa`, `nodejs`, `vanilla-js`, `hisaab-pro`, `small-business`, `india`

### 6.2 Résumé Entry

The project should be buildable into a résumé bullet point like:

> **Hisaab Pro** — Full-stack offline-first business ledger · Vanilla JS, Node.js, SQLite, Python Flask · 8-layer AES-256 encryption with plausible-deniability dual-password login · PWA with offline sync · Deployed for a real client (family retail shop, Rajasthan)

Key résumé-worthy signals to build for:
- "Deployed for a real client" — not a toy project
- "Offline-first PWA with encrypted local database"
- "Dual-password plausible deniability system"
- "LAN sync without any cloud dependency"
- "Configurable for multi-client deployment"

### 6.3 Demo & Screenshots

Before final deployment, produce:

- Annotated screenshots of: Login page, Dashboard, New Sale form, Invoice PDF, Debtor Aging Report, Mobile PWA view, Sync status screen
- A short screen recording (GIF or MP4, ~60 seconds) showing the core flow: login → add sale → generate invoice PDF
- Stored in `/docs/screenshots/` and embedded in the README

---

## 8. Client Deployment Model

Hisaab Pro supports two delivery modes:

### 7.1 Personal Instance (Developer's Father)
- The original deployment; used as real production data
- Hardcoded shop name, GST number, address, and logo in `config.json`
- Not part of the public repo

### 7.2 Client Instance (Other Shop Owners)
- A personalized copy of the same codebase configured for a new client
- Customization done entirely via `config.json` — no code changes needed for basic setup

**`config.json` fields for client customization:**

```json
{
  "shop": {
    "name": "Sharma Hardware & Sanitary",
    "address": "Main Market, Sādri, Rajasthan",
    "phone": "+91-XXXXX-XXXXX",
    "gstin": "08XXXXX",
    "logo_path": "assets/logo.png"
  },
  "currency": "INR",
  "tax_rate": 18,
  "invoice_prefix": "INV",
  "locale": "hi-IN",
  "backup": {
    "auto_time": "23:00",
    "usb_drive_label": "HISAABPRO_BKP"
  }
}
```

**Client delivery checklist:**
- [ ] Clone base repo into a private client folder
- [ ] Fill in `config.json` with client's shop details
- [ ] Add client's logo to `assets/`
- [ ] Run seed script to set up empty database + decoy data
- [ ] Install on client's Windows PC
- [ ] Train client (1–2 hour session)
- [ ] Hand over printed quick-reference guide
- [ ] Set up first USB backup

**Pricing model (suggested):**
- One-time setup fee for installation + training
- Optional annual maintenance / support retainer
- No recurring software license fee (local software, not SaaS)

---

## 9. System Architecture

### 9.1 Architectural Philosophy

Hisaab Pro is built in **three evolutionary tiers**. The codebase is written in v1 to run entirely offline and locally, but every structural decision is made so that upgrading to a higher tier requires the least possible rewrite.

```
TIER 1 (v1 — NOW)          TIER 2 (future)           TIER 3 (future)
─────────────────          ───────────────           ───────────────
Local desktop app    →     Multi-device LAN    →     Cloud / SaaS
Single shop              + Multi-user roles        + Multi-shop
SQLite                   + PostgreSQL option        + Hosted DB
No login roles           + Cashier / Owner          + Subscription
LAN sync only            + Remote VPN access        + Web dashboard
```

Every module, route, and database table is written as if it could be extracted into a microservice later. No spaghetti. No hardcoded shop logic. All shop-specific values live in `config.json`.

### 9.2 Components

**Desktop Application (Node.js + Express + Vanilla JS)**
- Runs on the shop's Windows PC at `http://localhost:3000`
- Hosts the main encrypted SQLite database
- Serves the frontend — same HTML/JS/CSS files power both desktop and a future web version
- Runs the LAN sync server (port 5000)
- Modular route structure: each feature (sales, payments, accounts) is an independent Express router that can be extracted later

**Mobile PWA (Vanilla JS + Service Worker)**
- Installed via browser "Add to Home Screen" on Android 7+
- Holds an encrypted local copy of the database (IndexedDB)
- Works 100% offline after pre-loading at shop
- Same UI component patterns as desktop — shared CSS design system

**Sync System**
- Local WiFi only in v1 — never touches the internet
- Flask server listens only on `192.168.x.x`
- Sync protocol is versioned (`/sync/v1/...`) so it can be upgraded without breaking existing clients
- Device approval + revocation managed from desktop

### 9.3 Scalability Design Decisions

| Decision | v1 Implementation | Why it scales |
|----------|------------------|---------------|
| All business logic in `server/modules/` | SQLite + Express | Swap SQLite → PostgreSQL by changing one DB adapter file |
| Auth middleware is role-aware from day one | Single owner role enforced | Add cashier/accountant roles by flipping role checks |
| All API routes versioned (`/api/v1/`) | One version | Add `/api/v2/` without breaking existing clients |
| Config-driven shop identity | `config.json` | Multi-tenant: load config per subdomain or per client DB |
| Frontend uses a `api.js` fetch wrapper | Calls `localhost:3000` | Change base URL once to point to cloud server |
| Modules are folders, not files | `modules/sales/`, `modules/payments/` | Each folder becomes a microservice or plugin |
| Sync protocol is versioned | `/sync/v1/` | Upgrade sync without breaking old mobile installs |

---

## 10. Tech Stack

No build tools. No frameworks. No cloud. Everything runs with a single `node server.js` command — and is structured to scale when the time comes.

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend UI** | Vanilla HTML + CSS + JavaScript (ES6+) | Zero build step; works on Windows 7 Chromium; readable by anyone; scales to React/Vue later with same API |
| **Styling** | Custom CSS design system (CSS variables) | Theme-able per client via CSS variable overrides; no framework lock-in; bundled locally |
| **Charts** | Chart.js v3 (bundled locally) | Lightweight; no build required; works offline; compatible with Chromium 108 (Electron v22) |
| **Backend** | Node.js 18 LTS + Express 4 | Stable on Windows 7; modular router structure; same codebase can move to cloud |
| **Database** | SQLite + better-sqlite3 | v1 local file; swap to PostgreSQL adapter in v2 with minimal changes |
| **DB Encryption** | SQLCipher (`@journeyapps/sqlcipher`) | AES-256 encrypted SQLite; transparent to app layer |
| **Password hashing** | bcryptjs | Pure JS; no native deps; works on all Windows versions |
| **PDF generation** | jsPDF + html2canvas | Client-side; no server needed; works offline |
| **Sync server** | Python 3.8 + Flask 2 | Lightweight; Windows 7 compatible; versioned sync endpoints |
| **Mobile** | PWA: Vanilla JS + Service Worker + IndexedDB | Android 7+ compatible; no app store; same design system as desktop |
| **Mobile encryption** | CryptoJS AES-256 (bundled locally) | Pure JS; no native deps; works in all Android Chrome versions |
| **Version control** | Git + GitHub | Public portfolio repo |
| **Desktop packaging** | Electron v22 (optional) | Windows 7/10/11 compatible; wraps into `.exe` |

### 10.1 CSS Design System

Rather than a CSS framework, Hisaab Pro uses a **custom design system** built on CSS custom properties. This gives full visual control, works on old Chromium, and lets each client instance be themed by changing a single variables file.

```css
/* theme.css — the only file that changes per client */
:root {
  /* Brand */
  --color-primary:     #2563EB;   /* Main action color */
  --color-primary-light: #EFF6FF;
  --color-accent:      #16A34A;   /* Success / paid */
  --color-danger:      #DC2626;   /* Overdue / alert */
  --color-warning:     #D97706;   /* Pending */

  /* Surfaces */
  --color-bg:          #F8FAFC;
  --color-surface:     #FFFFFF;
  --color-border:      #E2E8F0;

  /* Typography */
  --font-family:       'Inter', 'Segoe UI', Arial, sans-serif;
  --font-size-base:    15px;      /* Slightly large for shopkeeper readability */
  --font-size-lg:      18px;
  --font-size-xl:      24px;

  /* Spacing */
  --radius:            8px;
  --shadow:            0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:         0 4px 12px rgba(0,0,0,0.10);
}
```

**UI principles:**
- Large touch targets (min 44px height) — works on both mouse and touchscreen
- High contrast text — readable in bright shop lighting
- Maximum 3 clicks to reach any function — non-technical users don't get lost
- Status always visible — every number on screen has a label; no mystery icons
- Consistent color language: blue = action, green = paid/success, red = overdue/alert, orange = pending

### 10.2 Why Vanilla JS

- Zero build pipeline — `npm install && node server.js` is all anyone needs
- Runs as-is on Windows 7 Electron without transpilation
- Demonstrates JS fundamentals to recruiters without framework abstraction
- Same HTML/JS files work in a future cloud deployment — just change the API base URL
- Every module is a plain JS class or function — easy to extract or replace

---

## 11. Project Structure

```
hisaab-pro/
├── README.md
├── CHANGELOG.md
├── LICENSE                            ← MIT (open-source base)
├── CLIENT_LICENSE.md                  ← Terms for personalized client installs
├── config.json                        ← All client-specific values live here
├── package.json
│
├── server/
│   ├── index.js                       ← Entry point: node server.js
│   ├── config.js                      ← Loads + validates config.json
│   ├── db/
│   │   ├── database.js                ← DB adapter (swap SQLite → Postgres here only)
│   │   ├── schema.sql
│   │   └── seed.js                    ← Demo + decoy data generator
│   ├── modules/                       ← Each module is self-contained
│   │   ├── auth/
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.service.js        ← Dual-password logic here
│   │   │   └── auth.middleware.js
│   │   ├── sales/
│   │   │   ├── sales.routes.js
│   │   │   └── sales.service.js
│   │   ├── payments/
│   │   ├── accounts/
│   │   ├── reports/
│   │   └── sync/                      ← Sync server logic
│   └── shared/
│       ├── logger.js
│       └── roles.js                   ← Role definitions (owner, cashier, accountant)
│
├── client/
│   ├── index.html                     ← Login
│   ├── dashboard.html
│   ├── sales.html
│   ├── payments.html
│   ├── accounts.html
│   ├── reports.html
│   ├── settings.html
│   ├── css/
│   │   ├── theme.css                  ← CSS variables (only file changed per client)
│   │   ├── main.css                   ← Layout, components, utilities
│   │   ├── components.css             ← Buttons, cards, tables, forms
│   │   └── print.css                  ← Print/PDF styles
│   ├── js/
│   │   ├── api.js                     ← Fetch wrapper (change base URL → cloud ready)
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── sales.js
│   │   ├── payments.js
│   │   ├── accounts.js
│   │   ├── reports.js
│   │   ├── pdf.js
│   │   └── utils.js                   ← formatINR, formatDate, debounce, etc.
│   └── assets/
│       ├── logo.png                   ← Replaced per client
│       ├── chart.min.js               ← Chart.js (local, no CDN)
│       └── inter-font/                ← Bundled font (no Google Fonts)
│
├── mobile/
│   ├── index.html
│   ├── manifest.json
│   ├── service-worker.js
│   ├── css/
│   │   ├── theme.css                  ← Same variables as desktop
│   │   └── mobile.css
│   └── js/
│       ├── db.js                      ← IndexedDB wrapper
│       ├── sync.js
│       ├── crypto.js                  ← CryptoJS AES-256
│       └── app.js
│
├── sync/
│   ├── sync_server.py                 ← Flask sync server
│   ├── requirements.txt
│   └── device_registry.json
│
├── scripts/
│   ├── backup.js
│   ├── restore.js
│   └── setup.js                       ← First-run wizard (generates config, seeds DB)
│
└── docs/
    ├── screenshots/
    ├── architecture.md                ← Tier 1→2→3 upgrade guide
    ├── user-manual.md
    ├── security-guide.md
    └── client-setup-guide.md
```

---

## 12. Feature Requirements

### 11.1 Authentication

| Feature | Priority | Notes |
|---------|----------|-------|
| Username + password login | P0 | Required to access any data |
| **Dual-password system** | P0 | Real password → real data; Decoy password → fake data |
| Session management + auto-logout | P0 | Inactivity timeout (default 15 min, configurable) |
| Auto-wipe on 3 failed logins | P0 | Replaces real DB with dummy data, logs incident |
| Activity logging | P1 | Every login, logout, modification, export logged with timestamp |
| Suspicious activity alerts | P1 | Decoy password use, failed attempts, off-hours access |

**Dual-password behavior:**
- Real password: Shows actual sales, debtor balances, customer list
- Decoy password: Shows a believable but fabricated smaller-scale business (~10% of actual figures, different customer names)
- Both paths look identical in UI — indistinguishable to a casual observer

### 11.2 Sales Management

| Feature | Priority |
|---------|----------|
| Create invoice: date, customer, line items (qty × rate), auto-subtotal, 18% GST, total | P0 |
| Auto-generated invoice number (prefix from `config.json`) | P0 |
| View/search sales by date, customer, invoice number, status (paid/pending) | P0 |
| Edit and delete past sales (with audit trail) | P1 |
| Daily and monthly sales totals | P0 |

### 11.3 Payment Management

| Feature | Priority |
|---------|----------|
| Record incoming payments (from customers) | P0 |
| Record outgoing payments (to suppliers) | P0 |
| Payment modes: Cash, Bank Transfer, UPI/Online, Cheque | P0 |
| Payment reference field (cheque no., UPI ID) | P1 |
| Payment reconciliation: match payments to invoices, show outstanding | P0 |
| View/filter payments by date, account, mode | P1 |

### 11.4 Accounts & Chart of Accounts

| Feature | Priority |
|---------|----------|
| Customer accounts (debtors) | P0 |
| Supplier accounts (creditors) | P0 |
| Cash and bank accounts | P0 |
| Expense and revenue accounts | P1 |
| Running balance per account | P0 |
| Add / edit accounts | P0 |

### 11.5 Dashboard

| Feature | Priority |
|---------|----------|
| Today's sales total | P0 |
| This month's sales total | P0 |
| Total outstanding (debtors) | P0 |
| Total payable (creditors) | P0 |
| Cash balance + bank balance | P0 |
| Last 10 transactions | P0 |
| Charts: daily trend, monthly comparison, debtor distribution, payment mode breakdown | P1 |

### 11.6 Reports & PDF Export

All reports exportable as A4 PDFs, printable directly from the browser.

| Report | Contents | Format |
|--------|----------|--------|
| **Invoice / Bill** | Shop header (from config), invoice #, customer, line items, GST, total, payment status | A4 portrait |
| **Daily Sales Report** | All sales for a date, customer-wise breakdown, daily total | A4 portrait |
| **Weekly Report** | Daily breakdown, comparison to prior week | A4 portrait |
| **Monthly Financial Report** | Income, expenses, net profit, full transaction list | A4 landscape |
| **Debtor Aging Report** | Outstanding by customer; 0–30 / 30–60 / 60+ day buckets | A4 landscape |
| **Creditor Payment Schedule** | Supplier list, amounts payable, due dates, status | A4 landscape |
| **Account Balance Sheet** | All account balances, assets vs. liabilities | A4 portrait |
| **Custom Date Range** | Any report filtered by user-specified date range | A4 |

PDF generation: `jsPDF` + `html2canvas` · Target: < 3 seconds per report

### 11.7 Mobile PWA

**Read (always available offline):**
- View all accounts and balances
- View sales history (search by customer, date)
- View debtor list with aging breakdown
- Filter/search all records

**Write (stored locally, synced later):**
- Add new sale (full form, same as desktop)
- Record payment received
- Pending-sync indicator showing count of unsynced changes

**Offline behavior:**
- Pre-loads full encrypted database from desktop before leaving shop (Friday AM)
- All local data encrypted with CryptoJS AES-256 in IndexedDB
- Auto-locks after 5 minutes of inactivity
- PDF export and print (via Bluetooth or WiFi printer)

**PWA requirements:**
- Installable via browser "Add to Home Screen" (Android + iOS)
- Service worker for offline caching
- No Play Store / App Store required

### 11.8 Sync System

| Feature | Priority |
|---------|----------|
| Desktop Flask server on LAN only (192.168.x.x) | P0 |
| First sync requires manual device approval + password | P0 |
| Full pre-load: desktop → mobile | P0 |
| Incremental sync: mobile sends only new/changed records | P0 |
| Sync completes in < 30 seconds for typical weekly delta | P0 |
| Last-sync timestamp shown on both devices | P1 |
| Device revocation (stolen phone instant disconnect) | P0 |
| TLS 1.3 for all sync traffic | P0 |

---

## 13. Security Requirements

Hisaab Pro implements 8 independent security layers:

| Layer | Mechanism |
|-------|-----------|
| **1 — Physical disk** | BitLocker (Windows) or VeraCrypt encrypted container |
| **2 — File location** | Database hidden in non-obvious system path with randomized filename |
| **3 — Database content** | SQLCipher AES-256 encrypted SQLite |
| **4 — Application login** | Dual-password system (real vs. decoy data) |
| **5 — Mobile data** | CryptoJS AES-256 in IndexedDB; auto-lock after 5 min |
| **6 — Sync network** | LAN-only, TLS 1.3, device approval required |
| **7 — Backups** | Daily USB (auto 11 PM) + Weekly external drive + Monthly bank safe |
| **8 — Audit log** | Encrypted activity log for every access and modification |

**Backup schedule:**

| Frequency | Medium | Location |
|-----------|--------|----------|
| Daily (11 PM, automatic) | USB stick (rotate 3) | Office desk drawer |
| Weekly (Sunday) | External hard drive | Home safe/locker |
| Monthly (1st of month) | External hard drive | Bank safety deposit box |

---

## 14. Database Schema

| Table | Key Fields |
|-------|-----------|
| `users` | id, username, password_hash, role, is_decoy |
| `sales` | id, invoice_no, date, customer_account_id, subtotal, tax, total, status |
| `sales_items` | id, sale_id, item_name, qty, rate, amount |
| `payments` | id, date, account_id, amount, mode, reference, type (in/out) |
| `accounts` | id, name, type (customer/supplier/cash/bank/expense/revenue), opening_balance |
| `transactions` | id, date, account_id, amount, description, linked_payment_id |
| `activity_log` | id, timestamp, user_id, action, details |
| `sync_sessions` | id, device_id, device_name, last_sync, approved, revoked |

Database: SQLite with SQLCipher · Driver: `better-sqlite3` + `@journeyapps/sqlcipher`

---

## 15. Development Phases

| Phase | Weeks | Effort | Deliverable |
|-------|-------|--------|-------------|
| **1 — Setup & Planning** | 1–2 | ~10 hrs | Repo structure, schema design, folder setup, Git init, README skeleton |
| **2 — Desktop Core** | 3–4 | ~45 hrs | Login, DB, sales, payments, accounts, dashboard (Vanilla JS) |
| **3 — Security & Encryption** | 5 | ~25 hrs | BitLocker/VeraCrypt, dual-password, auto-wipe, automated backups |
| **4 — Reports & PDF** | 6 | ~25 hrs | All report types, PDF export via jsPDF, print styles |
| **5 — Mobile PWA & Sync** | 7 | ~30 hrs | PWA, offline IndexedDB, Flask sync server, device management |
| **6 — Testing, Docs & Deploy** | 8 | ~20 hrs | QA, polished README, screenshots, client setup guide, user training |
| **Total** | **8 weeks** | **~155 hrs** | Live system + showcase-ready GitHub repo + first client deployment |

---

## 16. Success Criteria

### Product (Client)
- [ ] Log in and record a sale end-to-end in under 2 minutes
- [ ] Generate a printed GST invoice from a sale in under 30 seconds
- [ ] Export a monthly financial report as PDF for the accountant
- [ ] Use mobile app fully offline for 2 days after pre-loading at shop
- [ ] Sync all mobile changes back to desktop in under 30 seconds
- [ ] Enter decoy password and see believable fake data (not obviously fake)
- [ ] Restore database from USB backup after simulated data loss
- [ ] Revoke a device from the sync panel

### Portfolio (GitHub / Résumé)
- [ ] Public GitHub repo with polished README, screenshots, and working demo mode
- [ ] Repo cloneable and demoable by anyone: `npm install && node server.js`
- [ ] Résumé entry clearly communicates: real deployment + security engineering + offline-first PWA + vanilla JS full-stack
- [ ] At least one GIF/video demonstrating the full flow in the README

### Client Delivery
- [ ] New client onboarded from zero to live system in under 3 hours
- [ ] `config.json` is the only file changed to rebrand for a new shop
- [ ] Printed user manual and quick-reference card delivered with installation

---

## 17. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| SQLCipher native build issues on Windows | Use `@journeyapps/sqlcipher` pre-built binaries; test on target Windows version early in Week 3 |
| Mobile offline sync conflicts | Last-write-wins with timestamp; flag conflicts for manual review in desktop UI |
| BitLocker recovery key loss | Store printed key in bank deposit box; documented in user manual |
| PWA IndexedDB storage limits on mobile | Monitor quota; compress before storage; warn user when > 80% full |
| Decoy data looks obviously fake | Pre-generate realistic dataset with plausible names, amounts, and date distribution |
| Client can't maintain system independently | Deliver printed manual + short screen recording walkthrough; provide WhatsApp support contact |

---

## 18. Future Versions (Out of Scope for v1)

- Inventory / stock tracking
- GST e-filing integration
- Multi-user roles (cashier vs. owner)
- WhatsApp bill sharing directly from the app
- Bank statement auto-reconciliation
- Remote access over the internet (VPN-based, opt-in)
- SaaS / hosted version for multiple clients

---

*This PRD is a living document. Update as requirements evolve during development.*  
*For client deployments, a copy of this PRD is maintained per client in their private folder.*
