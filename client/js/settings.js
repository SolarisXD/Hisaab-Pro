/**
 * settings.js — Hisaab Pro Settings Page Controller
 */

'use strict';

(function() {
    checkAuth().then(function(user) {
        if (!user) return;
        loadCommonUI();
        loadSettings();
        updateView();
        updateSidebarActiveState();
    });

    function updateView() {
        var params = new URLSearchParams(window.location.search);
        var view = params.get('view') || 'shop';
        
        var sections = document.querySelectorAll('.settings-section');
        sections.forEach(s => s.classList.add('hidden'));

        if (view === 'shop') {
            document.getElementById('section-shop').classList.remove('hidden');
        } else if (view === 'fy') {
            document.getElementById('container-fy-book').classList.remove('hidden');
            document.getElementById('panel-fy').classList.remove('hidden');
            document.getElementById('panel-book').classList.add('hidden', 'md:block');
        } else if (view === 'book') {
            document.getElementById('container-fy-book').classList.remove('hidden');
            document.getElementById('panel-fy').classList.add('hidden', 'md:block');
            document.getElementById('panel-book').classList.remove('hidden');
        } else if (view === 'security') {
            document.getElementById('section-security').classList.remove('hidden');
        } else if (view === 'shortcuts') {
            document.getElementById('section-shortcuts').classList.remove('hidden');
            populateShortcutsList();
        }

        // Update top tabs
        var tabs = document.querySelectorAll('.settings-nav-tab');
        tabs.forEach(tab => {
            if (tab.getAttribute('data-view') === view) {
                tab.classList.add('bg-primary/10', 'text-primary');
                tab.classList.remove('text-on-surface-variant');
            } else {
                tab.classList.remove('bg-primary/10', 'text-primary');
                tab.classList.add('text-on-surface-variant');
            }
        });
    }

    // Toggle sidebar
    var sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            var sidebar = document.getElementById('sidebar');
            var overlay = document.getElementById('sidebar-overlay');
            sidebar.classList.toggle('-translate-x-full');
            overlay.classList.toggle('hidden');
        });
    }
    
    var sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            var sidebar = document.getElementById('sidebar');
            sidebar.classList.add('-translate-x-full');
            sidebarOverlay.classList.add('hidden');
        });
    }

    function updateSidebarActiveState() {
        var links = document.querySelectorAll('#sidebar [data-page]');
        links.forEach(function(link) {
            if (link.getAttribute('data-page') === 'settings') {
                link.classList.add('sidebar-active');
                link.classList.remove('text-slate-600', 'hover:bg-[#e4e2e1]/50');
                var icon = link.querySelector('.material-symbols-outlined');
                if (icon) icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                link.classList.remove('sidebar-active');
            }
        });
    }

    // Event Listeners
    if (document.getElementById('btn-save-shop')) {
        document.getElementById('btn-save-shop').addEventListener('click', updateShopInfo);
    }
    
    if (document.getElementById('btn-save-book-settings')) {
        document.getElementById('btn-save-book-settings').addEventListener('click', updateBookSettings);
    }

    if (document.getElementById('btn-manual-backup')) {
        document.getElementById('btn-manual-backup').addEventListener('click', runManualBackup);
    }

    var passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', updatePassword);
    }

    if (document.getElementById('btn-save-fy')) {
        document.getElementById('btn-save-fy').addEventListener('click', createFinancialYear);
    }
    
    var btnSaveBackupPath = document.getElementById('btn-save-backup-path');
    if (btnSaveBackupPath) {
        btnSaveBackupPath.addEventListener('click', function() {
            var path = document.getElementById('backup-custom-path').value;
            api.updateShopConfig({ backup_path: path }).then(function() {
                showToast('Backup path updated!', 'success');
            }).catch(function(err) {
                showToast('Error: ' + err.message, 'error');
            });
        });
    }

    function loadSettings() {
        // Load Shop Config
        api.getConfig().then(function(config) {
            if (document.getElementById('shop-name')) document.getElementById('shop-name').value = config.shop.name;
            if (document.getElementById('shop-gstin')) document.getElementById('shop-gstin').value = config.shop.gstin || '';
            if (document.getElementById('shop-address')) document.getElementById('shop-address').value = config.shop.address || '';
            if (document.getElementById('shop-phone')) document.getElementById('shop-phone').value = config.shop.phone || '';
            if (document.getElementById('shop-tax-rate')) document.getElementById('shop-tax-rate').value = config.tax_rate || 0;
            if (document.getElementById('shop-prefix')) document.getElementById('shop-prefix').value = config.invoice_prefix || '';
            
            var backupPathEl = document.getElementById('backup-custom-path');
            if (backupPathEl) backupPathEl.value = config.backup_path || '';
        });

        // Load Book settings
        Promise.all([
            api.getSystemSetting('current_book_no').catch(() => ({ value: '1' })),
            api.getSystemSetting('current_bill_no').catch(() => ({ value: '1' }))
        ]).then(function(results) {
            if (document.getElementById('book-start-no')) {
                document.getElementById('book-start-no').value = results[0].value || '1';
            }
            if (document.getElementById('bill-start-no')) {
                document.getElementById('bill-start-no').value = results[1].value || '1';
            }
        });

        // Load Financial Years
        loadFinancialYears();

        // Load Security/Backup status
        loadSecurityStatus();
    }

    function updateShopInfo() {
        var data = {
            shop: {
                name: document.getElementById('shop-name').value,
                gstin: document.getElementById('shop-gstin').value,
                address: document.getElementById('shop-address').value,
                phone: document.getElementById('shop-phone').value
            },
            tax_rate: parseFloat(document.getElementById('shop-tax-rate').value),
            invoice_prefix: document.getElementById('shop-prefix').value
        };

        if (!data.shop.name) {
            showToast('Shop name is required', 'warning');
            return;
        }

        showConfirm({
            title: 'Update Shop Information',
            message: 'Are you sure you want to update your shop details? This will be reflected in all documents and reports.',
            confirmText: 'Update Details',
            intent: 'primary'
        }).then(function(confirmed) {
            if (!confirmed) return;

            api.updateShopConfig(data).then(function() {
                showToast('Shop information updated!', 'success');
                loadSettings();
            }).catch(function(err) {
                showToast('Error: ' + err.message, 'error');
            });
        });
    }

    function updateBookSettings() {
        var bookNo = document.getElementById('book-start-no').value;
        var billNo = document.getElementById('bill-start-no').value;

        showConfirm({
            title: 'Authorize Reference Sequence',
            message: 'Are you sure you want to update the Book-Page starting sequence? This will affect the next generated reference number.',
            confirmText: 'Authorize Sequence',
            intent: 'primary'
        }).then(function(confirmed) {
            if (!confirmed) return;

            Promise.all([
                api.setSystemSetting('current_book_no', bookNo),
                api.setSystemSetting('current_bill_no', billNo)
            ]).then(function() {
                showToast('Reference sequence authorized!', 'success');
            }).catch(function(err) {
                showToast('Error: ' + err.message, 'error');
            });
        });
    }

    function loadFinancialYears() {
        var fyActiveBadge = document.getElementById('fy-active-badge');
        var fyList = document.getElementById('fy-list');
        if (!fyList) return;

        api.getFinancialYears().then(function(years) {
            fyActiveBadge.innerHTML = '';
            fyList.innerHTML = '';

            api.getSettingsStatus().then(function(status) {
                var activeDb = status.database.active_file;
                
                years.unshift({
                    id: 'legacy',
                    name: 'Default Root Store',
                    start_date: '2000-01-01',
                    end_date: '2099-12-31',
                    db_filename: 'hisaab.db',
                    is_active: activeDb === 'hisaab.db' ? 1 : 0
                });

                var currentSessionDb = localStorage.getItem('hisaab_active_fy') || 'hisaab.db';

                years.forEach(function(fy) {
                    var isLiveSession = fy.db_filename === currentSessionDb;
                    
                    if (isLiveSession && fyActiveBadge) {
                        fyActiveBadge.innerHTML = '<div class="flex items-center gap-2 px-4 py-2 bg-on-primary-container/10 rounded-xl border border-on-primary-container/20"><span class="w-2 h-2 rounded-full bg-on-primary-container animate-pulse"></span><span class="text-[10px] font-black text-on-primary-container uppercase tracking-widest leading-none">Primary Active Session: ' + escapeHtml(fy.name) + '</span></div>';
                    }
                    
                    var periodText = fy.id === 'legacy' ? 'Continuous Ledger' : (formatDate(fy.start_date) + ' — ' + formatDate(fy.end_date));
                    
                    var fyItem = document.createElement('div');
                    fyItem.className = 'flex items-center justify-between p-5 bg-white rounded-2xl border border-outline-variant/10 hover:border-primary/20 transition-all group';
                    fyItem.innerHTML = `
                        <div>
                            <p class="font-black text-primary tracking-tight">${escapeHtml(fy.name)}</p>
                            <p class="text-[10px] font-bold text-on-surface-variant opacity-60 uppercase tracking-tighter mt-0.5">${periodText}</p>
                        </div>
                        <div class="flex items-center gap-3">
                            ${isLiveSession ? '<span class="text-[9px] font-black text-on-primary-container bg-on-primary-container/10 px-2 py-1 rounded uppercase tracking-widest">LIVE</span>' : ''}
                            ${!isLiveSession ? `<button class="px-4 py-2 bg-surface-container-high rounded-xl text-[10px] font-black text-primary uppercase hover:bg-primary hover:text-white transition-all" onclick="activateFY('${fy.id}', '${fy.db_filename}')">Switch Context</button>` : ''}
                        </div>
                    `;
                    fyList.appendChild(fyItem);
                });
            });
        });
    }

    window.activateFY = function(id, dbFilename) {
        showConfirm({
            title: 'Switch Financial Year',
            message: 'Are you sure you want to switch your active session to this financial year? The page will reload.',
            confirmText: 'Switch Session',
            intent: 'primary'
        }).then(function(confirmed) {
            if (!confirmed) return;
            api.activateFinancialYear(id).then(function() {
                localStorage.setItem('hisaab_active_fy', dbFilename);
                window.location.reload();
            }).catch(function(err) {
                showToast('Error: ' + err.message, 'error');
            });
        });
    };

    function createFinancialYear() {
        var data = {
            name: document.getElementById('fy-name').value,
            start_date: document.getElementById('fy-start').value,
            end_date: document.getElementById('fy-end').value
        };

        if (!data.name || !data.start_date || !data.end_date) {
            showToast('Please fill all fields', 'warning');
            return;
        }

        showConfirm({
            title: 'Create Financial Year',
            message: 'Are you sure you want to create a new financial year? Ensure dates do not overlap with existing years.',
            confirmText: 'Create FY',
            intent: 'primary'
        }).then(function(confirmed) {
            if (!confirmed) return;

            api.createFinancialYear(data).then(function() {
                showToast('Financial Year created!', 'success');
                closeFYModal();
                loadFinancialYears();
            }).catch(function(err) {
                showToast('Error: ' + err.message, 'error');
            });
        });
    }

    function loadSecurityStatus() {
        api.getSettingsStatus().then(function(status) {
            var container = document.getElementById('backup-info');
            if (!container) return;
            
            var lastBackup = status.backup.last_backup 
                ? formatDate(status.backup.last_backup.time) + ' (' + status.backup.last_backup.filename + ')'
                : 'Never';
            
            container.innerHTML = `
                <div class="grid grid-cols-2 gap-y-4 gap-x-10">
                    <div class="space-y-1">
                        <p class="opacity-40 font-black uppercase tracking-widest text-[8px]">Active Vault File</p>
                        <p class="font-mono font-bold text-primary truncate">${escapeHtml(status.database.active_file)}</p>
                    </div>
                    <div class="space-y-1 text-right">
                        <p class="opacity-40 font-black uppercase tracking-widest text-[8px]">Failed Accesses</p>
                        <p class="font-black text-error text-sm">${status.security.failed_logins} / 5</p>
                    </div>
                    <div class="space-y-1 col-span-2">
                        <p class="opacity-40 font-black uppercase tracking-widest text-[8px]">Last Sync Timestamp</p>
                        <p class="font-bold text-primary">${lastBackup}</p>
                    </div>
                </div>
            `;
        });
    }

    function runManualBackup() {
        api.runManualBackup().then(function() {
            showToast('Backup successfully created!', 'success');
            loadSecurityStatus();
        }).catch(function(err) {
            showToast('Backup failed: ' + err.message, 'error');
        });
    }

    function updatePassword(e) {
        e.preventDefault();
        var oldP = document.getElementById('old-password').value;
        var newP = document.getElementById('new-password').value;
        var confirmP = document.getElementById('confirm-password').value;

        if (newP !== confirmP) {
            showToast('New passwords do not match', 'warning');
            return;
        }

        api.post('/auth/change-password', {
            old_password: oldP,
            new_password: newP
        }).then(function() {
            showToast('Password updated!', 'success');
            document.getElementById('password-form').reset();
        }).catch(function(err) {
            showToast('Error: ' + err.message, 'error');
        });
    }

    // Modal Helpers
    window.openFYModal = function() {
        document.getElementById('fy-modal').classList.add('active');
    };
    window.closeFYModal = function() {
        document.getElementById('fy-modal').classList.remove('active');
    };

    // Helper functions
    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        var d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text ? String(text) : '';
        return div.innerHTML;
    }

    function showToast(message, type) {
        if (window.showNotification) {
            window.showNotification(message, type);
        }
    }

    // Populate Keyboard Shortcuts List
    window.populateShortcutsList = function() {
        var shortcuts = [
            { key: 'F10', desc: 'Toggle Calculator', category: 'Calculator' },
            { key: 'Alt + Q', desc: 'Quick Add Menu (↑↓ to navigate, Enter to select)', category: 'Navigation' },
            { key: 'F2', desc: 'Save / Authorize Transaction', category: 'Global' },
            { key: 'F8', desc: 'Delete Record', category: 'Global' },
            { key: 'Escape', desc: 'Close Modal / Calculator / Menu', category: 'Global' },
            { key: 'Ctrl + S', desc: 'Quick Save', category: 'Global' },
            { key: 'Ctrl + P', desc: 'Print / Download PDF', category: 'Global' },
            { key: 'Alt + P', desc: 'New Purchase', category: 'Navigation' },
            { key: 'Alt + S', desc: 'Go to Sales', category: 'Navigation' },
            { key: 'Alt + A', desc: 'Go to Accounts', category: 'Navigation' },
            { key: 'Alt + H', desc: 'Go to Dashboard', category: 'Navigation' },
            { key: 'Alt + L', desc: 'Open Ledger Report', category: 'Navigation' }
        ];

        var container = document.getElementById('shortcuts-list');
        if (!container) return;

        var html = '';
        shortcuts.forEach(function(s) {
            var keyClass = s.category === 'Calculator' ? 'bg-primary/20 text-primary' : 
                        s.category === 'Navigation' ? 'bg-secondary/20 text-secondary' :
                        'bg-surface-container-highest text-on-surface';
            html += '<div class="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-all">';
            html += '<div class="flex items-center gap-4">';
            html += '<span class="px-3 py-1.5 rounded-lg text-xs font-bold ' + keyClass + '">' + s.key + '</span>';
            html += '<span class="text-xs font-medium text-on-surface">' + s.desc + '</span>';
            html += '</div>';
            html += '<span class="text-[10px] font-bold uppercase tracking-widest opacity-30">' + s.category + '</span>';
            html += '</div>';
        });

        container.innerHTML = html;
    };
})();
