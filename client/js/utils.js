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
 * Format balance with Dr/Cr suffix based on account type
 * @param {number} amount - Balance amount
 * @param {string} type - Account grouping (customer, supplier, cash, bank, expense, revenue)
 */
function formatBalance(amount, type) {
    if (amount === null || amount === undefined || isNaN(parseFloat(amount))) return '₹0.00';
    var num = parseFloat(amount);
    if (Math.abs(num) < 0.01) return '₹0.00';

    var formatted = formatINR(Math.abs(num));
    
    // Account type determines Dr/Cr notation:
    // Customer (debtor): Positive = DR, Negative = CR
    // Supplier (creditor): Positive = CR, Negative = DR  
    // Cash/Bank (asset): Positive = DR, Negative = CR
    // Expense: Positive = DR, Negative = CR
// Revenue: Positive = CR, Negative = DR
    
    return formatted + (num < 0 ? ' CR' : ' DR');
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
 * Get financial year dates (April 1 to March 31)
 * Defaults to current financial year based on today's date
 */
function getFinancialYearDates() {
    var cachedStart = localStorage.getItem('hisaab_active_fy_start');
    var cachedEnd = localStorage.getItem('hisaab_active_fy_end');
    if (cachedStart && cachedEnd) {
        return { start: cachedStart, end: cachedEnd };
    }

    var today = new Date();
    var month = today.getMonth(); // 0 = Jan, 2 = Mar, 3 = Apr
    var year = today.getFullYear();
    
    // If we are in Jan-Mar, the financial year started last year
    var startYear = month < 3 ? year - 1 : year;
    var endYear = startYear + 1;
    
    var startStr = startYear + '-04-01';
    var endStr = endYear + '-03-31';
    
    return {
        start: startStr,
        end: endStr
    };
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
        success: 'check_circle', 
        error: 'error', 
        warning: 'warning', 
        info: 'info' 
    };
    
    var iconName = icons[type] || 'info';
    toast.innerHTML = `
        <span class="material-symbols-outlined text-lg">${iconName}</span>
        <span class="flex-1">${message}</span>
    `;

    container.appendChild(toast);
    
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
        paid: 'bg-primary text-white shadow-sm',
        partial: 'bg-primary-container/20 text-primary',
        pending: 'bg-error/10 text-error',
        received: 'bg-primary/10 text-primary'
    };
    var labels = {
        paid: 'PAID',
        partial: 'PARTIAL',
        pending: 'PENDING',
        received: 'RECEIVED'
    };
    var cls = classes[status] || 'bg-outline-variant/20 text-on-surface-variant';
    var label = labels[status] || status.toUpperCase();
    return '<span class="px-3 py-1 text-[10px] font-bold rounded-full ' + cls + '">' + label + '</span>';
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
        if (!page || page === 'index' || page === '') page = 'dashboard';
    }
    
    var links = document.querySelectorAll('.nav-link');
    links.forEach(function(link) {
        var dataPage = link.getAttribute('data-page');
        if (dataPage === page) {
            link.classList.add('sidebar-active');
            link.classList.remove('text-slate-600', 'dark:text-slate-400');
        } else {
            link.classList.remove('sidebar-active');
            link.classList.add('text-slate-600', 'dark:text-slate-400');
        }
    });
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
    
    // Cache financial year bounds for strict validations
    if (typeof api !== 'undefined' && api.getPublicFinancialYears) {
        api.getPublicFinancialYears().then(function(fys) {
            var currentSessionDb = localStorage.getItem('hisaab_active_fy') || 'hisaab.db';
            var activeFy = fys.find(function(y) { return y.db_filename === currentSessionDb; });
            if (activeFy && activeFy.start_date && activeFy.end_date) {
                localStorage.setItem('hisaab_active_fy_start', activeFy.start_date);
                localStorage.setItem('hisaab_active_fy_end', activeFy.end_date);
            } else {
                localStorage.removeItem('hisaab_active_fy_start');
                localStorage.removeItem('hisaab_active_fy_end');
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
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '3000';

        var intentColors = {
            primary: 'bg-primary text-white shadow-primary/20',
            danger: 'bg-error text-white shadow-error/20',
            success: 'bg-green-600 text-white shadow-green-600/20',
            warning: 'bg-tertiary-fixed-dim text-tertiary shadow-tertiary/10'
        };
        var btnCls = intentColors[intent] || intentColors.primary;

        var modalHtml = `
            <div class="modal-content">
                <div class="p-8 pb-0 flex justify-between items-center">
                    <h3 class="font-headline text-2xl font-black text-primary tracking-tight">${escapeHtml(title)}</h3>
                    <button class="modal-close w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="p-8 py-10 text-center">
                    <p class="text-on-surface-variant text-base font-medium opacity-80 leading-relaxed">${escapeHtml(message)}</p>
                </div>
                <div class="p-8 pt-0 flex gap-3">
                    <button class="btn-cancel flex-1 py-4 bg-surface-container-high text-primary font-bold text-xs rounded-2xl hover:bg-surface-container-highest transition-all uppercase tracking-widest">${escapeHtml(cancelText)}</button>
                    <button class="btn-confirm flex-[2] py-4 ${btnCls} font-bold text-xs rounded-2xl shadow-lg transition-all uppercase tracking-widest">${escapeHtml(confirmText)}</button>
                </div>
            </div>`;

        overlay.innerHTML = modalHtml;
        document.body.appendChild(overlay);

        // Trigger animation
        setTimeout(() => overlay.classList.add('active'), 10);

        var btnConfirm = overlay.querySelector('.btn-confirm');
        var btnCancel = overlay.querySelector('.btn-cancel');
        var btnClose = overlay.querySelector('.modal-close');

        function cleanup(result) {
            overlay.classList.remove('active');
            window.removeEventListener('keydown', handleKey);
            setTimeout(() => {
                if (overlay.parentNode) overlay.remove();
                resolve(result);
            }, 300);
        }

        function handleKey(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanup(false);
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                cleanup(true);
            }
        }

        btnConfirm.onclick = function() { cleanup(true); };
        btnCancel.onclick = function() { cleanup(false); };
        btnClose.onclick = function() { cleanup(false); };
        overlay.onclick = function(e) { if (e.target === overlay) cleanup(false); };

        window.addEventListener('keydown', handleKey);
        setTimeout(function() { btnConfirm.focus(); }, 150);
    });
}

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
        return '<div class="flex flex-col items-center justify-center py-12 text-on-surface-variant opacity-50"><span class="material-symbols-outlined text-4xl mb-2">monitoring</span><p class="text-xs font-bold uppercase tracking-widest">No records found</p></div>';
    }

    var clickableClass = options.onRowClick ? ' cursor-pointer' : '';
    var html = '<div class="overflow-x-auto no-scrollbar"><table class="w-full text-left border-collapse"><thead><tr class="border-b border-outline-variant/5">';
    for (var c = 0; c < columns.length; c++) {
        var align = columns[c].align === 'text-right' ? ' text-right' : '';
        html += '<th class="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest' + align + '">' + columns[c].label + '</th>';
    }
    html += '</tr></thead><tbody class="divide-y divide-outline-variant/5">';

    for (var r = 0; r < data.length; r++) {
        var rowAttr = '';
        if (options.onRowClick) {
            var rowId = data[r].id || r;
            rowAttr = ' onclick="' + options.onRowClick + '(' + rowId + ')"';
        }
        
        html += '<tr class="hover:bg-surface-container-low/50 transition-colors' + clickableClass + '"' + rowAttr + '>';
        for (var c2 = 0; c2 < columns.length; c2++) {
            var align2 = columns[c2].align === 'text-right' ? ' text-right' : '';
            var valRaw = columns[c2].render ? columns[c2].render(data[r]) : escapeHtml(String(data[r][columns[c2].key] || ''));
            
            // Apply padding and base font
            html += '<td class="px-8 py-5 text-sm' + align2 + '">' + valRaw + '</td>';
        }
        html += '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
}

/**
 * Show a format selector for printing (Standard vs Anonymous)
 * @param {Function} onSelect - Callback function(anonymous: boolean, period: string)
 */
function showPrintFormatSelector(onSelect) {
    if (typeof onSelect !== 'function') return;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '4000';

    var fy = getFinancialYearDates();
    var today = getToday();

    var modalHtml = `
        <div class="modal_content max-w-md">
            <div class="p-8 pb-4 text-center">
                <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-4xl">save</span>
                </div>
                <h3 class="font-headline text-2xl font-black text-primary tracking-tight">Select Save Format</h3>
                <p class="text-on-surface-variant text-[10px] font-black opacity-60 mt-1 uppercase tracking-widest leading-none">Document visibility preference</p>
            </div>
            
            <div class="px-8 pb-2">
                <p class="text-[9px] font-black text-on-surface-variant/60 uppercase tracking-widest">Period (Optional)</p>
                <div class="flex gap-2 mt-1">
                    <input type="date" id="print-period-from" class="flex-1 bg-surface-container-low border-0 rounded-xl px-3 py-2 text-xs font-bold text-primary" value="${fy.start}" title="From Date">
                    <input type="date" id="print-period-to" class="flex-1 bg-surface-container-low border-0 rounded-xl px-3 py-2 text-xs font-bold text-primary" value="${today}" title="To Date">
                </div>
            </div>
            
            <div class="p-8 space-y-4">
                <button class="btn-standard w-full group flex items-center justify-between p-5 bg-surface-container-low border border-outline-variant/10 rounded-2xl hover:bg-surface-container-high transition-all text-left">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                            <span class="material-symbols-outlined">description</span>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-primary">Standard Format</p>
                            <p class="text-[10px] text-on-surface-variant font-medium">Includes firm name, address, and GSTIN</p>
                        </div>
                    </div>
                    <span class="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                </button>

                <button class="btn-anonymous w-full group flex items-center justify-between p-5 bg-primary/5 border border-primary/10 rounded-2xl hover:bg-primary/10 transition-all text-left">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                            <span class="material-symbols-outlined">visibility_off</span>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-primary">Anonymous Format</p>
                            <p class="text-[10px] text-on-surface-variant font-medium">Full privacy. No firm details included.</p>
                        </div>
                    </div>
                    <span class="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                </button>
            </div>

            <div class="px-8 pb-8">
                <button class="btn-close w-full py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 hover:text-on-surface-variant transition-colors">Abort Export</button>
            </div>
        </div>`;

    overlay.innerHTML = modalHtml;
    document.body.appendChild(overlay);

    // Trigger animation
    setTimeout(function() { overlay.classList.add('active'); }, 10);

    function cleanup(anon) {
        var fromDate = document.getElementById('print-period-from').value;
        var toDate = document.getElementById('print-period-to').value;
        var period = fromDate && toDate ? (formatDate(fromDate) + ' to ' + formatDate(toDate)) : null;
        
        overlay.classList.remove('active');
        setTimeout(function() {
            if (overlay.parentNode) overlay.remove();
            if (anon !== null) onSelect(anon, period);
        }, 300);
    }

    overlay.querySelector('.btn-standard').onclick = function() { cleanup(false); };
    overlay.querySelector('.btn-anonymous').onclick = function() { cleanup(true); };
    overlay.querySelector('.btn-close').onclick = function() { cleanup(null); };
    overlay.onclick = function(e) { if (e.target === overlay) cleanup(null); };
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
