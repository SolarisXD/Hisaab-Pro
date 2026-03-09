/**
 * settings.js — Hisaab Pro Settings Page Controller
 */

'use strict';

(function() {
    checkAuth().then(function(user) {
        if (!user) return;
        loadCommonUI();
        loadSettings();
    });

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
            message: 'Are you sure you want to update the current Book No and Page No? This affects next auto-generated references.',
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

            if (years.length === 0) {
                fyList.innerHTML = '<p class="text-muted" style="font-size:13px;">No financial years defined.</p>';
                return;
            }

            var html = '<table class="table" style="font-size: 13px;"><thead><tr><th>FY Name</th><th>Period</th><th>Status</th><th></th></tr></thead><tbody>';
            years.forEach(function(fy) {
                var isActive = fy.is_active === 1;
                if (isActive) {
                    fyActiveBadge.innerHTML = '<span class="badge badge-success" style="font-size:14px; padding: 8px 12px;">Active FY: ' + escapeHtml(fy.name) + '</span>';
                }
                
                html += '<tr><td>' + escapeHtml(fy.name) + '</td><td>' + formatDate(fy.start_date) + ' to ' + formatDate(fy.end_date) + '</td><td>' + 
                        (isActive ? '<span class="text-success">Active</span>' : '<span class="text-muted">Inactive</span>') + '</td><td>' +
                        (!isActive ? '<button class="btn btn-ghost btn-sm" onclick="activateFY(' + fy.id + ')">Activate</button>' : '') + 
                        '</td></tr>';
            });
            html += '</tbody></table>';
            fyList.innerHTML = html;
        });
    }

    window.activateFY = function(id) {
        showConfirm({
            title: 'Switch Financial Year',
            message: 'Switch to this financial year? This change is global and will affect all data visibility.',
            confirmText: 'Switch FY',
            intent: 'warning'
        }).then(function(confirmed) {
            if (!confirmed) return;
            api.activateFinancialYear(id).then(function() {
                showToast('Financial Year activated!', 'success');
                loadFinancialYears();
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
            message: 'Are you sure you want to create a new financial year?',
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
            message: 'Are you sure you want to change your administration password?',
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
