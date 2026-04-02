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
            document.getElementById('panel-book').classList.add('hidden', 'md:block'); // On desktop, both might show if structured that way, but let's follow the routing
        } else if (view === 'book') {
            document.getElementById('container-fy-book').classList.remove('hidden');
            document.getElementById('panel-fy').classList.add('hidden', 'md:block');
            document.getElementById('panel-book').classList.remove('hidden');
        } else if (view === 'security') {
            document.getElementById('section-security').classList.remove('hidden');
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
    document.getElementById('btn-save-shop').addEventListener('click', updateShopInfo);
    document.getElementById('btn-save-book-settings').addEventListener('click', updateBookSettings);
    document.getElementById('btn-manual-backup').addEventListener('click', runManualBackup);
    document.getElementById('password-form').addEventListener('submit', updatePassword);
    document.getElementById('btn-save-fy').addEventListener('click', createFinancialYear);
    
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
            
            document.getElementById('shop-name').value = config.shop.name;
            document.getElementById('shop-gstin').value = config.shop.gstin || '';
            document.getElementById('shop-address').value = config.shop.address || '';
            document.getElementById('shop-phone').value = config.shop.phone || '';
            document.getElementById('shop-tax-rate').value = config.tax_rate || 0;
            document.getElementById('shop-prefix').value = config.invoice_prefix || '';
            
            var backupPathEl = document.getElementById('backup-custom-path');
            if (backupPathEl) backupPathEl.value = config.backup_path || '';
        });

        // Load Book settings
        Promise.all([
            api.getSystemSetting('current_book_no'),
            api.getSystemSetting('current_page_no')
        ]).then(function(results) {
            document.getElementById('setting-book-no').value = results[0].value || '01';
            document.getElementById('setting-page-no').value = results[1].value || '01';
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
        var bookNo = document.getElementById('setting-book-no').value;
        var pageNo = document.getElementById('setting-page-no').value;

        showConfirm({
            title: 'Update Book Settings',
            message: 'Are you sure you want to update the current Book No and Page No? WARNING: Changing this incorrectly might cause invoice number collisions or gaps. Only change this if you are starting a new physical ledger book.',
            confirmText: 'Update Settings',
            intent: 'primary'
        }).then(function(confirmed) {
            if (!confirmed) return;

            Promise.all([
                api.setSystemSetting('current_book_no', bookNo),
                api.setSystemSetting('current_page_no', pageNo)
            ]).then(function() {
                showToast('Book reference settings updated!', 'success');
            }).catch(function(err) {
                showToast('Error: ' + err.message, 'error');
            });
        });
    }

    function loadFinancialYears() {
        api.getFinancialYears().then(function(years) {
            var fyActiveBadge = document.getElementById('fy-active-badge');
            var fyList = document.getElementById('fy-list');
            
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

                if (years.length === 0) {
                    fyList.innerHTML = '<p class="text-[10px] font-bold text-on-surface-variant/40 text-center py-10 uppercase tracking-widest">No archival periods defined</p>';
                    return;
                }

                var currentSessionDb = localStorage.getItem('hisaab_active_fy') || 'hisaab.db';

                years.forEach(function(fy) {
                    var isLiveSession = fy.db_filename === currentSessionDb;
                    
                    if (isLiveSession) {
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
            // Also notify the backend so it remembers this state system-wide
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
                    <div class="space-y-1">
                        <p class="opacity-40 font-black uppercase tracking-widest text-[8px]">Archived Snapshots</p>
                        <p class="font-black text-primary text-sm">${status.backup.total_backups}</p>
                    </div>
                    <div class="space-y-1 text-right">
                        <p class="opacity-40 font-black uppercase tracking-widest text-[8px]">Integrity Check</p>
                        <p class="font-black ${status.security.is_nuked ? 'text-error' : 'text-green-600'} text-[10px] uppercase">${status.security.is_nuked ? 'COMPROMISED' : 'VERIFIED'}</p>
                    </div>
                </div>
            `;
        });
    }
    function runManualBackup() {
        showConfirm({
            title: 'Manual Backup',
            message: 'Do you want to create a manual backup of the system database now?',
            confirmText: 'Create Backup',
            intent: 'success'
        }).then(function(confirmed) {
            if (!confirmed) return;
            
            var btn = document.getElementById('btn-manual-backup');
            btn.disabled = true;
            btn.textContent = '⏳ Backing up...';
            
            api.runManualBackup().then(function() {
                showToast('Backup created successfully!', 'success');
                loadSecurityStatus();
            }).catch(function(err) {
                showToast('Backup failed: ' + err.message, 'error');
            }).finally(function() {
                btn.disabled = false;
                btn.textContent = 'Create Manual Backup';
            });
        });
    }

    function updatePassword(e) {
        e.preventDefault();
        var old = document.getElementById('pass-old').value;
        var newP = document.getElementById('pass-new').value;
        var conf = document.getElementById('pass-confirm').value;

        if (newP !== conf) return showToast('New passwords match', 'warning');
        if (newP.length < 6) return showToast('Minimum 6 characters', 'warning');

        showConfirm({
            title: 'Change Password',
            message: 'Are you sure you want to change your administration password? WARNING: If you forget the new password, you will be locked out of the system. There is no password recovery.',
            confirmText: 'Change Password',
            intent: 'warning'
        }).then(function(confirmed) {
            if (!confirmed) return;

            api.post('/auth/change-password', { old_password: old, new_password: newP })
                .then(function() {
                    showToast('Password updated!', 'success');
                    document.getElementById('password-form').reset();
                })
                .catch(function(err) {
                    showToast('Error: ' + err.message, 'error');
                });
        });
    }

    window.openFYModal = function() {
        var modal = document.getElementById('fy-modal');
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.add('opacity-100');
            modal.querySelector('.scale-95').classList.remove('scale-95');
        }, 10);
    };
    window.closeFYModal = function() {
        var modal = document.getElementById('fy-modal');
        modal.classList.remove('opacity-100');
        modal.querySelector('.transform').classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

})();
