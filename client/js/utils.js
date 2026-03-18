/**
 * utils.js — Hisaab Pro Shared Utilities
 * 
 * Formatting, DOM helpers, toast notifications, and common functions.
 */

'use strict';

/**
 * Format amount as Indian Rupees (Positive only)
 */
function formatINR(amount) {
    if (amount === null || amount === undefined) return '₹0.00';
    var num = Math.abs(parseFloat(amount));
    if (isNaN(num)) return '₹0.00';

    // Indian number formatting: 1,23,456.78
    var parts = num.toFixed(2).split('.');
    var intPart = parts[0];
    var decPart = parts[1];

    // Format with Indian grouping
    var lastThree = intPart.substring(intPart.length - 3);
    var remaining = intPart.substring(0, intPart.length - 3);
    if (remaining.length > 0) {
        lastThree = ',' + lastThree;
    }
    var formatted = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

    return '₹' + formatted + '.' + decPart;
}

/**
 * Format balance with DR/CR notation
 * @param {number} amount - The numeric balance
 * @param {string} type - Account grouping (customer, supplier, cash, bank, expense, revenue)
 */
function formatBalance(amount, type) {
    if (amount === null || amount === undefined || isNaN(parseFloat(amount))) return '₹0.00';
    var num = parseFloat(amount);
    if (Math.abs(num) < 0.01) return '₹0.00';

    var formatted = formatINR(num);
    
    // Default accounting notation:
    // Customer (Asset): Positive = DR, Negative = CR
    // Supplier (Liability): Positive = CR, Negative = DR
    // Cash/Bank (Asset): Positive = DR, Negative = CR
    // Expense: Positive = DR, Negative = CR
    // Revenue: Positive = CR, Negative = DR
    
    var suffix = '';
    if (type === 'customer' || type === 'cash' || type === 'bank' || type === 'expense') {
        suffix = num > 0 ? ' DR' : ' CR';
    } else if (type === 'supplier' || type === 'revenue') {
        suffix = num > 0 ? ' CR' : ' DR';
    } else {
        // Fallback for unknown types (Asset-like convention)
        suffix = num > 0 ? ' DR' : ' CR';
    }

    return formatted + suffix;
}

/**
 * Format date as DD/MM/YYYY
 */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var day = ('0' + d.getDate()).slice(-2);
    var month = ('0' + (d.getMonth() + 1)).slice(-2);
    var year = d.getFullYear();
    return day + '/' + month + '/' + year;
}

/**
 * Format date and time
 */
function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return formatDate(dateStr) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getToday() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonth() {
    var now = new Date();
    return now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
}

/**
 * Debounce function
 */
function debounce(fn, delay) {
    var timer;
    return function() {
        var context = this;
        var args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function() {
            fn.apply(context, args);
        }, delay);
    };
}

/**
 * Show a toast notification
 */
function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast ' + type;

    var icons = { 
        success: '<i data-lucide="check-circle-2"></i>', 
        error: '<i data-lucide="alert-circle"></i>', 
        warning: '<i data-lucide="alert-triangle"></i>', 
        info: '<i data-lucide="info"></i>' 
    };
    toast.innerHTML = '<span>' + (icons[type] || '') + '</span> ' + message;

    container.appendChild(toast);
    
    // Initialize icons in toast
    if (window.lucide) lucide.createIcons();

    // Auto-dismiss after 4 seconds
    setTimeout(function() {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(function() {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 4000);
}

/**
 * Get status badge HTML
 */
function getStatusBadge(status) {
    var classes = {
        paid: 'badge-success',
        partial: 'badge-warning',
        pending: 'badge-danger'
    };
    var labels = {
        paid: 'Paid',
        partial: 'Partial',
        pending: 'Pending'
    };
    var cls = classes[status] || 'badge-info';
    var label = labels[status] || status;
    return '<span class="badge ' + cls + '">' + label + '</span>';
}

/**
 * Get payment mode label
 */
function getPaymentModeLabel(mode) {
    var labels = {
        cash: 'Cash',
        bank_transfer: 'Bank Transfer',
        upi: 'UPI / Online',
        cheque: 'Cheque'
    };
    return labels[mode] || mode;
}

/**
 * Extract form data as object
 */
function getFormData(formElement) {
    var formData = new FormData(formElement);
    var data = {};
    formData.forEach(function(value, key) {
        data[key] = value;
    });
    return data;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/**
 * Set active nav link
 */
function setActiveNav(page) {
    if (!page) {
        var path = window.location.pathname;
        page = path.split('/').pop().replace('.html', '');
        if (!page || page === 'index') page = 'dashboard';
    }
    var links = document.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
        links[i].classList.remove('active');
        if (links[i].getAttribute('data-page') === page) {
            links[i].classList.add('active');
        }
    }
}

/**
 * Load common UI elements like sidebar shop name, footer, and active link.
 */
function loadCommonUI() {
    // Populate shop info if elements exist
    if (typeof api !== 'undefined' && api.getConfig) {
        api.getConfig().then(function(config) {
            if (config && config.shop) {
                var shopName = config.shop.name;
                var sidebarShopName = document.getElementById('sidebar-shop-name');
                var footerShopName = document.getElementById('footer-shop-name');
                
                if (sidebarShopName) sidebarShopName.textContent = shopName;
                if (footerShopName) footerShopName.textContent = shopName;
                
                // Update document title if it's the default
                if (document.title.indexOf('Hisaab Pro') !== -1) {
                    var parts = document.title.split(' — ');
                    if (parts.length > 1) {
                        document.title = parts[0] + ' — ' + shopName;
                    } else {
                        document.title = shopName + ' — Hisaab Pro';
                    }
                }
            }
        }).catch(function() {});
    }
    
    // Set active nav
    setActiveNav();
    
    // Init sidebar toggle
    initSidebar();

    // Re-init lucide icons for any dynamic elements
    if (window.lucide) lucide.createIcons();
}

/**
 * Initialize sidebar toggle for mobile
 */
function initSidebar() {
    var toggle = document.getElementById('sidebar-toggle');
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');

    if (toggle && sidebar) {
        toggle.addEventListener('click', function() {
            sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('active');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', function() {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
}

/**
 * Show a custom confirmation modal
 * @param {Object} options { title, message, confirmText, cancelText, intent }
 * @returns {Promise<boolean>}
 */
function showConfirm(options) {
    options = options || {};
    var title = options.title || 'Confirm Action';
    var message = options.message || 'Are you sure you want to proceed?';
    var confirmText = options.confirmText || 'Confirm';
    var cancelText = options.cancelText || 'Cancel';
    var intent = options.intent || 'primary'; // primary, danger, success

    return new Promise(function(resolve) {
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.zIndex = '3000'; // Above everything

        var modalHtml = 
            '<div class="modal" style="max-width: 420px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);">' +
                '<div class="modal-header">' +
                    '<h3>' + escapeHtml(title) + '</h3>' +
                    '<button class="modal-close">✕</button>' +
                '</div>' +
                '<div class="modal-body" style="padding: 24px; text-align: center;">' +
                    '<p style="font-size: 16px; color: var(--color-text-secondary); line-height: 1.5;">' + escapeHtml(message) + '</p>' +
                '</div>' +
                '<div class="modal-footer" style="padding: 16px 24px; background: var(--color-bg);">' +
                    '<button class="btn btn-outline btn-cancel" style="min-width: 100px;">' + escapeHtml(cancelText) + '</button>' +
                    '<button class="btn btn-' + intent + ' btn-confirm" style="min-width: 120px;">' + escapeHtml(confirmText) + '</button>' +
                '</div>' +
            '</div>';

        overlay.innerHTML = modalHtml;
        document.body.appendChild(overlay);

        var btnConfirm = overlay.querySelector('.btn-confirm');
        var btnCancel = overlay.querySelector('.btn-cancel');
        var btnClose = overlay.querySelector('.modal-close');

        function cleanup(result) {
            overlay.remove();
            window.removeEventListener('keydown', handleKey);
            resolve(result);
        }

        function handleKey(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanup(false);
            }
            if (e.key === 'Enter' || e.key === 'F2') {
                e.preventDefault();
                cleanup(true);
            }
        }

        btnConfirm.onclick = function() { cleanup(true); };
        btnCancel.onclick = function() { cleanup(false); };
        btnClose.onclick = function() { cleanup(false); };
        overlay.onclick = function(e) { if (e.target === overlay) cleanup(false); };

        window.addEventListener('keydown', handleKey);
        
        // Auto-focus confirm button for better UX
        setTimeout(function() { btnConfirm.focus(); }, 100);

        if (window.lucide) lucide.createIcons();
    });
}

/**
 * Logout
 */
/**
 * Logout with backup prompt
 */
function logout() {
    showConfirm({
        title: 'Logout',
        message: 'Would you like to take a backup of your data before logging out?',
        confirmText: 'Backup & Logout',
        cancelText: 'Logout Only',
        intent: 'primary'
    }).then(function(wantsBackup) {
        // Here, showConfirm returns true for 'Backup & Logout'
        // But we need a way to detect 'Logout Only' vs 'Cancel'.
        // Let's refine the logic to use a nested or custom prompt.
        
        if (wantsBackup) {
            showToast('Creating backup...', 'info');
            api.runManualBackup()
                .then(function() {
                    showToast('Backup created. Logging out...', 'success');
                    return api.post('/auth/logout');
                })
                .then(function() {
                    window.location.href = '/index.html';
                })
                .catch(function(err) {
                    showToast('Backup failed: ' + err.message + '. Proceeding to logout...', 'warning');
                    setTimeout(() => { window.location.href = '/index.html'; }, 2000);
                });
        } else {
            // User clicked 'Logout Only' or Cancel? 
            // The current showConfirm resolves false for Cancel/X/Escape.
            // I'll update showConfirm to support a 'danger' cancel or a specific 'Logout Only' action.
            
            // For now, let's just do a sequential check or a simpler prompt.
            performLogoutDirect();
        }
    });
}

function performLogoutDirect() {
    showConfirm({
        title: 'Confirm Logout',
        message: 'Are you sure you want to log out without a backup?',
        confirmText: 'Log out',
        intent: 'danger'
    }).then(function(confirmed) {
        if (!confirmed) return;
        api.post('/auth/logout').finally(function() {
            window.location.href = '/index.html';
        });
    });
}

/**
 * Exit Application with backup prompt
 */
function exitApp() {
    showConfirm({
        title: 'Exit Application',
        message: 'Would you like to take a backup before closing Hisaab Pro?',
        confirmText: 'Backup & Exit',
        cancelText: 'Exit Only',
        intent: 'primary'
    }).then(function(wantsBackup) {
        if (wantsBackup) {
            showToast('Creating backup...', 'info');
            api.runManualBackup()
                .then(function() {
                    showToast('Backup created. Closing...', 'success');
                    return api.post('/auth/logout');
                })
                .then(function() {
                    window.location.href = '/index.html';
                })
                .catch(function() {
                    window.location.href = '/index.html';
                });
        } else {
            showConfirm({
                title: 'Confirm Exit',
                message: 'Are you sure you want to exit without a backup?',
                confirmText: 'Exit Now',
                intent: 'danger'
            }).then(function(confirmed) {
                if (!confirmed) return;
                api.post('/auth/logout').finally(function() {
                    window.location.href = '/index.html';
                });
            });
        }
    });
}

/**
 * Render a simple table from data array
 */
function renderTable(data, columns, options) {
    options = options || {};
    if (!data || data.length === 0) {
        return '<div class="empty-state"><div class="empty-icon"><i data-lucide="monitor-off"></i></div><p>No records found</p></div>';
    }

    var clickableClass = options.onRowClick ? ' table-clickable' : '';
    var html = '<div class="table-wrapper"><table class="table' + clickableClass + '"><thead><tr>';
    for (var c = 0; c < columns.length; c++) {
        var align = columns[c].align ? ' class="' + columns[c].align + '"' : '';
        html += '<th' + align + '>' + columns[c].label + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (var r = 0; r < data.length; r++) {
        var rowAttr = '';
        if (options.onRowClick) {
            // Store index or ID to retrieve when clicked
            var rowId = data[r].id || r;
            rowAttr = ' onclick="' + options.onRowClick + '(' + rowId + ')"';
        }
        
        html += '<tr' + rowAttr + '>';
        for (var c2 = 0; c2 < columns.length; c2++) {
            var align2 = columns[c2].align ? ' class="' + columns[c2].align + '"' : '';
            var value = columns[c2].render ? columns[c2].render(data[r]) : escapeHtml(String(data[r][columns[c2].key] || ''));
            html += '<td' + align2 + '>' + value + '</td>';
        }
        html += '</tr>';
    }

    html += '</tbody></table></div>';
    
    // Auto-init icons after render if Lucide is available
    setTimeout(function() {
        if (window.lucide) lucide.createIcons();
    }, 0);

    return html;
}

/**
 * Download data as CSV
 */
function downloadCSV(data, filename) {
    if (!data || data.length === 0) return;
    
    // Get headers from first object
    var headers = Object.keys(data[0]);
    var csvContent = headers.join(',') + '\n';
    
    data.forEach(function(row) {
        var values = headers.map(function(header) {
            var val = row[header];
            if (val === null || val === undefined) return '';
            var escaped = String(val).replace(/"/g, '""');
            return '"' + escaped + '"';
        });
        csvContent += values.join(',') + '\n';
    });
    
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    if (link.download !== undefined) {
        var url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
