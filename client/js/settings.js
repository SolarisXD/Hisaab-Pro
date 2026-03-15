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
        for (var i = 0; i < sections.length; i++) {
            sections[i].style.display = 'none';
        }

        if (view === 'shop') {
            document.getElementById('section-shop').style.display = 'block';
        } else if (view === 'fy') {
            document.getElementById('container-fy-book').style.display = 'grid';
            document.getElementById('panel-fy').style.display = 'block';
            document.getElementById('panel-book').style.display = 'none';
        } else if (view === 'book') {
            document.getElementById('container-fy-book').style.display = 'grid';
            document.getElementById('panel-fy').style.display = 'none';
            document.getElementById('panel-book').style.display = 'block';
        } else if (view === 'security') {
            document.getElementById('section-security').style.display = 'block';
        }
    }

    function updateSidebarActiveState() {
        var params = new URLSearchParams(window.location.search);
        var view = params.get('view') || 'shop';
        
        var settingsNav = document.querySelector('.nav-link[data-page="settings"]');
        if (!settingsNav) return;
        
        var subMenu = settingsNav.nextElementSibling;
        if (subMenu && subMenu.classList.contains('nav-sub-menu')) {
            var subLinks = subMenu.querySelectorAll('.nav-sub-link');
            for (var i = 0; i < subLinks.length; i++) {
                var href = subLinks[i].getAttribute('href');
                if (href.includes('view=' + view)) {
                    subLinks[i].classList.add('active');
                } else {
                    subLinks[i].classList.remove('active');
                }
            }
        }
    }

    // Event Listeners
    document.getElementById('btn-save-shop').addEventListener('click', updateShopInfo);
    document.getElementById('btn-save-book-settings').addEventListener('click', updateBookSettings);
    document.getElementById('btn-manual-backup').addEventListener('click', runManualBackup);
    document.getElementById('password-form').addEventListener('submit', updatePassword);
    document.getElementById('btn-save-fy').addEventListener('click', createFinancialYear);

    function loadSettings() {
        // Load Shop Config
        api.getConfig().then(function(config) {
            
            document.getElementById('shop-name').value = config.shop.name;
            document.getElementById('shop-gstin').value = config.shop.gstin || '';
            document.getElementById('shop-address').value = config.shop.address || '';
            document.getElementById('shop-phone').value = config.shop.phone || '';
            document.getElementById('shop-tax-rate').value = config.tax_rate || 0;
            document.getElementById('shop-prefix').value = config.invoice_prefix || '';
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
                
                // Always add the default legacy database as an option
                years.unshift({
                    id: 'legacy',
                    name: 'Current/Legacy Data',
                    start_date: '2000-01-01',
                    end_date: '2099-12-31',
                    db_filename: 'hisaab.db',
                    is_active: activeDb === 'hisaab.db' ? 1 : 0
                });

                if (years.length === 0) {
                    fyList.innerHTML = '<p class="text-muted" style="font-size:13px;">No financial years defined.</p>';
                    return;
                }

                var html = '<table class="table" style="font-size: 13px;"><thead><tr><th>FY Name</th><th>Period</th><th>Status</th><th>Action</th></tr></thead><tbody>';
                
                var currentSessionDb = localStorage.getItem('hisaab_active_fy') || 'hisaab.db';

                years.forEach(function(fy) {
                    var isLiveSession = fy.db_filename === currentSessionDb;

                    if (isLiveSession) {
                        fyActiveBadge.innerHTML = '<span class="badge badge-success" style="font-size:14px; padding: 8px 12px;">Active FY: ' + escapeHtml(fy.name) + '</span>';
                    }
                    
                    var periodText = fy.id === 'legacy' ? 'N/A' : (formatDate(fy.start_date) + ' to ' + formatDate(fy.end_date));
                    
                    html += '<tr><td>' + escapeHtml(fy.name) + '</td><td>' + periodText + '</td><td>' + 
                            (isLiveSession ? '<span class="text-success"><strong>Active</strong></span>' : '<span class="text-muted">Inactive</span>') + '</td><td>' +
                            (!isLiveSession ? `<button class="btn btn-ghost btn-sm" onclick="activateFY('${fy.id}', '${fy.db_filename}')">Switch To This</button>` : '') + 
                            '</td></tr>';
                });
                html += '</tbody></table>';
                fyList.innerHTML = html;
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
            
            container.innerHTML = 
                '<div style="font-size: 14px; line-height: 2;">' +
                '<div><strong>Active Data File:</strong> <span class="badge badge-primary" style="font-family: monospace;">' + escapeHtml(status.database.active_file) + '</span></div>' +
                '<div><strong>Failed Login Attempts:</strong> ' + status.security.failed_logins + ' / 5</div>' +
                '<div><strong>Last Backup:</strong> ' + lastBackup + '</div>' +
                '<div><strong>Total Backups Saved:</strong> ' + status.backup.total_backups + '</div>' +
                '<div><strong>Security Status:</strong> ' + (status.security.is_nuked ? '<span class="badge badge-danger">WIPED/DECOY MODE</span>' : '<span class="badge badge-success">OK</span>') + '</div>' +
                '</div>';
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
        document.getElementById('fy-modal').classList.add('active');
    };
    window.closeFYModal = function() {
        document.getElementById('fy-modal').classList.remove('active');
    };

})();
