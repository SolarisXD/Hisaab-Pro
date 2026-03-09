/**
 * utils.js — Hisaab Pro Shared Utilities
 * 
 * Formatting, DOM helpers, toast notifications, and common functions.
 */

'use strict';

/**
 * Format amount as Indian Rupees
 */
function formatINR(amount) {
    if (amount === null || amount === undefined) return '₹0';
    var num = parseFloat(amount);
    if (isNaN(num)) return '₹0';

    var isNegative = num < 0;
    num = Math.abs(num);

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

    return (isNegative ? '-' : '') + '₹' + formatted + '.' + decPart;
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
 * Check if user is logged in (by trying to fetch /auth/me)
 */
function checkAuth() {
    return api.get('/auth/me')
        .then(function(user) {
            return user;
        })
        .catch(function() {
            var path = window.location.pathname;
            if (path !== '/' && !path.endsWith('/index.html')) {
                window.location.href = '/index.html';
            }
            return null;
        });
}

/**
 * Logout
 */
function logout() {
    api.post('/auth/logout')
        .then(function() {
            window.location.href = '/index.html';
        })
        .catch(function() {
            window.location.href = '/index.html';
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
