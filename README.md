# Hisaab Pro — Secure Business Ledger

> **Hisaab Pro** is a local-first, encrypted business ledger system designed for small retail shops. It works entirely offline on Windows (optimized for Windows 7+), providing high-speed operations without the need for internet or cloud subscriptions.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Offline First](https://img.shields.io/badge/offline-first-orange)

## ✨ Key Features

-   **Dashboard**: Real-time business overview (sales, outstanding, cash/bank balances).
-   **Sales Management**: Invoice generation, tax calculation, and payment status tracking.
-   **Payment Management**: Track incoming (customer) and outgoing (supplier) payments.
-   **Ledger (Accounts)**: Full chart of accounts with detailed transaction history.
-   **Financial Reports**: Daily sales, monthly revenue, debtor aging, and balance sheets.
-   **PDF Export**: High-quality A4 invoices and reports ready for printing.
-   **Security**: Local-first data storage (SQLCipher encryption coming in Phase 3).
-   **Speed**: Powered by SQLite & Vanilla JS for instant response times.

## 🚀 Quick Start

### Prerequisites
-   Node.js 18.x (LTS recommended)
-   Windows 7, 10, or 11

### Installation
1.  **Extract** the project folder.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Seed Database** (optional, for demo):
    ```bash
    npm run seed
    ```
4.  **Start Server**:
    ```bash
    npm start
    ```
5.  **Open Browser**:
    Navigate to `http://localhost:3000` (Chrome/Chromium recommended).

### Default Credentials
-   **Username**: `admin`
-   **Password**: `admin123`

## ⚙️ Configuration

Modify `config.json` to personalize the application for a specific client:
-   **Shop Info**: Name, Address, GSTIN, Phone.
-   **Finance**: Currency, Tax Rate (18% default), Invoice Prefix.
-   **Server**: Host and Port (default 3000).

---

## 🛠️ Tech Stack

-   **Backend**: Node.js + Express
-   **Database**: SQLite (`better-sqlite3`)
-   **Frontend**: Vanilla JS (ES6), CSS3, HTML5
-   **PDF**: jsPDF + html2canvas
-   **Charts**: Chart.js

## 📜 License

-   **Base System**: MIT License.
-   **Client Deployments**: See `CLIENT_LICENSE.md` for commercial deployment terms.

---
*Built with speed and security for local shops.*
