# Hisaab-Pro: USB Commercialization Roadmap
## The "Bring Your Own Drive" Software License (Option B)

This document outlines the exact technical steps required to transform the local Hisaab-Pro application into a premium, securely-licensed portable USB product. 

**IMPORTANT: Do not implement these until the core functionality (Local UI, Database, APIs) and testing are 100% complete.**

---

### Phase 1: Core Finalization (Your Current Stage)
1. **Complete all core features:** Ensure Payroll, Ledgers, Invoices, and Reports are fully bug-free.
2. **Standardize the Database:** Ensure the SQLite database schema is fully stable and no major migrations are expected shortly after launch.
3. **Local Testing:** Test thoroughly using `npm run dev` and a standard browser as you are doing now.

---

### Phase 2: Electron Transformation (The "Pro" Desktop Feel)
*Goal: Stop relying on the user's browser and a `.bat` file.*
1. **Install Electron:** Add `electron` and `electron-builder` to your project dependencies.
2. **Create `main.js` (Electron Entry Point):** Write the Electron boot script that starts your existing Express server on an unused port, and then opens a chromeless Electron `BrowserWindow` pointing to `http://localhost:<port>`.
3. **Disable DevTools:** Ensure users cannot open Chrome Developer Tools in the Electron window to inspect the local server or tamper with API requests.
4. **Compile an `.exe`:** Use `electron-builder` to package the Node app, Express, SQLite, and Electron into a single, double-clickable `HisaabPro.exe` file.

---

### Phase 3: Hardware DRM (Anti-Piracy & Licensing)
*Goal: Lock the `.exe` to the customer's specific USB drive.*
1. **Integrate a Device ID Library:** Use an npm package like `node-disk-info`, `drivelist`, or `systeminformation` within the Electron main process to read the **Volume/Hardware Serial Number** of the drive the `.exe` is currently running from.
2. **Implement the License Check:** 
   - When the user buys a license, they download the `.exe` and place it on their USB.
   - On first boot, the app generates a "Lock Code" (based on the USB serial number) and asks them to enter their purchased "Activation Key".
   - The app verifies the key against the Lock Code. If it matches, it writes a hidden `license.sig` file to the USB.
3. **Boot-Time Verification:** Every time `HisaabPro.exe` starts, it reads the current USB's serial number. If it doesn't match the one signed in `license.sig` (e.g., they copied the files to another USB), the app refuses to start and prompts for a valid license.

---

### Phase 4: Database Encryption (SQLCipher)
*Goal: Protect the physical `.sqlite` data from extraction.*
1. **Swap SQLite driver:** Replace the standard `sqlite3` or `better-sqlite3` package with `@journeyapps/sqlcipher` or `sqlite3` built with SQLCipher support.
2. **Master Password Implementation:** 
   - Modify the Express DB connection script: `db.run("PRAGMA key = 'my_secret_key'")`.
   - On the Electron boot screen, prompt the user for their "Vault Password". Pass this password locally to the Express backend to unlock the SQLite database in RAM.
3. **Handle Lockouts:** If they forget the password, the data is mathematically lost. Build clear UI warnings about this.

---

### Phase 5: The "Phantom Mode" (Yank Detection)
*Goal: Absolute physical security against unexpected seizures.*
1. **Path Polling:** In the Electron main process, write a `setInterval` that checks `fs.existsSync(process.execPath)` every 500ms.
2. **Instant Kill:** If the file system hook returns false (meaning the USB was physically removed from the port), execute `process.exit(1)` or `app.quit()` instantly. Because Electron is running from the USB, the OS will naturally crash the process anyway, but explicit handling prevents OS-level caching.

---

---

### Phase 6: Product Website & Installer Distribution
*Goal: A smooth customer experience for "Bring Your Own Drive."*
1. **The Product Site:** Build a landing page (e.g., `zerotrace-ledger.com`) selling the license. When they buy, they download a lightweight `USB-Installer.exe`.
2. **The Formatting Installer:** The user plugs in their own USB and runs `USB-Installer.exe`. The installer:
   - Formats the USB securely.
   - Copies the locked `HisaabPro.exe` and `database.sqlite` onto the USB.
   - Reads the USB's hardware serial number to bind the license lock.
   - Generates the `.sig` activation file specifically for that USB stick.

---

### Phase 7: Handling Software Updates (The Offline Challenge)
*Goal: Providing bug fixes and new features to software that intentionally never touches the internet.*
Since Hisaab-Pro is ultra-secure and local, you **cannot** have the `.exe` automatically phone home to download updates (that defeats the privacy pitch). Instead, you use an "Update Tool" approach:
1. **The Updater Executable:** On your product website, you release a `Hisaab-Update-v2.exe`.
2. **The Update Process:**
   - The user downloads `Hisaab-Update-v2.exe` to their main PC.
   - They plug in their secure Hisaab-Pro USB drive.
   - They run the Updater. The Updater detects the USB drive, verifies the license (`license.sig`), and carefully swaps out the old `HisaabPro.exe` with the new version.
3. **Database Migrations:** The Updater script must run your SQLite migration scripts (`ALTER TABLE...`) to upgrade their `database.sqlite` schema without ever touching or reading their actual financial data.
