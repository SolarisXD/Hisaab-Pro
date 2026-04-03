/**
 * accounts.js — Hisaab Pro Accounts Page Controller
 */

'use strict';

(function() {
    var currentType = '';
    var currentView = 'list';
    var editingAccountId = null;
    var editingTypeId = null;
    window.viewingAccountId = null; // Expose for HTML events
    var allAccountTypes = [];
    var currentAccountsData = [];

    checkAuth().then(function(user) {
        if (!user) return;
        loadCommonUI();
        
        // Handle view from URL
        var params = new URLSearchParams(window.location.search);
        currentView = params.get('view') || 'list';
        
        // Init ledger dates
        var ledgerDateFrom = document.getElementById('ledger-date-from');
        var ledgerDateTo = document.getElementById('ledger-date-to');
        var fy = getFinancialYearDates();
        if (ledgerDateFrom) ledgerDateFrom.value = fy.start;
        if (ledgerDateTo) ledgerDateTo.value = fy.end;

        loadInitialData();
    });

    function loadInitialData() {
        // Always load types first as they are needed for both views
        api.get('/accounts/types')
            .then(function(types) {
                allAccountTypes = types;
                renderTypeTabs();
                updateAccountTypeDropdown();
                
                if (currentView === 'types') {
                    showTypesView();
                } else {
                    showListView();
                }
            })
            .catch(function(err) {
                showToast('Failed to load account types: ' + err.message, 'error');
            });
    }
    
    function updateTabStyles() {
        var btnList = document.getElementById('btn-tab-list');
        var btnTypes = document.getElementById('btn-tab-types');
        
        if (btnList && btnTypes) {
            btnList.classList.toggle('tab-active', currentView === 'list');
            btnList.classList.toggle('text-on-surface-variant', currentView !== 'list');
            
            btnTypes.classList.toggle('tab-active', currentView === 'types');
            btnTypes.classList.toggle('text-on-surface-variant', currentView !== 'types');
        }
    }


    // --- Navigation & View Switching ---

    window.showListView = function() {
        currentView = 'list';
        document.getElementById('accounts-list-view').classList.remove('hidden');
        document.getElementById('account-types-view').classList.add('hidden');
        document.getElementById('ledger-panel').classList.add('hidden');
        
        document.getElementById('account-list-actions').classList.remove('hidden');
        document.getElementById('account-list-actions').classList.add('flex');
        document.getElementById('account-types-actions').classList.add('hidden');
        document.getElementById('account-types-actions').classList.remove('flex');
        
        updateTabStyles();
        loadAccounts();
    };

    window.showTypesView = function() {
        currentView = 'types';
        document.getElementById('accounts-list-view').classList.add('hidden');
        document.getElementById('account-types-view').classList.remove('hidden');
        document.getElementById('ledger-panel').classList.add('hidden');
        
        document.getElementById('account-list-actions').classList.add('hidden');
        document.getElementById('account-list-actions').classList.remove('flex');
        document.getElementById('account-types-actions').classList.remove('hidden');
        document.getElementById('account-types-actions').classList.add('flex');
        
        updateTabStyles();
        loadAccountTypes();
    };

    // --- Account Types Management ---

    function loadAccountTypes() {
        var container = document.getElementById('account-types-list');
        if (!container) return;
        container.innerHTML = '<div class="loading-overlay"><div class="spinner lg"></div></div>';

        api.get('/accounts/types', { include_inactive: 'true' })
            .then(function(types) {
                allAccountTypes = types;
                renderAccountTypes(types);
            })
            .catch(function(err) {
                container.innerHTML = '<div class="error-state text-error p-8 text-center font-bold">' + escapeHtml(err.message) + '</div>';
            });
    }

    function renderAccountTypes(types) {
        var container = document.getElementById('account-types-list');
        var html = renderTable(types, [
            { label: 'Name', key: 'name', render: function(row) {
                var icon = sanitizeIcon(row.icon || 'person');
                return '<div class="flex items-center gap-3">' +
                            '<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">' +
                                '<span class="material-symbols-outlined text-primary text-lg">' + icon + '</span>' +
                            '</div>' +
                            '<span class="font-bold text-primary">' + escapeHtml(row.name) + '</span>' +
                       '</div>';
            }},
            { label: 'Slug', key: 'slug', render: function(row) { return '<code class="bg-surface-container-high px-2 py-0.5 rounded text-xs">' + row.slug + '</code>'; } },
            { label: 'Usage', key: 'usage_count', align: 'text-center', render: function(row) {
                return '<span class="font-bold text-primary">' + (row.usage_count || 0) + ' Accounts</span>';
            }},
            { label: 'System', key: 'is_system', render: function(row) { 
                return row.is_system ? '<span class="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase">System</span>' : '<span class="px-2 py-0.5 bg-surface-container-high text-on-surface-variant text-[10px] font-bold rounded uppercase">Custom</span>';
            }},
            { label: 'Status', key: 'is_active', render: function(row) {
                return row.is_active ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">Active</span>' : '<span class="px-2 py-0.5 bg-error/10 text-error text-[10px] font-bold rounded uppercase">Inactive</span>';
            }}
        ], { onRowClick: 'editType' });
        
        container.innerHTML = html;
    }

    window.editType = function(id) {
        var type = allAccountTypes.find(t => t.id === id);
        if (type) openTypeModal(type);
    };

    function openTypeModal(type) {
        editingTypeId = type ? type.id : null;
        document.getElementById('type-modal-title').textContent = type ? 'Edit Account Group' : 'New Account Group';
        document.getElementById('type-name').value = type ? type.name : '';
        document.getElementById('type-icon').value = type ? (type.icon || 'person') : 'person';
        
        document.getElementById('btn-delete-type').style.display = (type && !type.is_system) ? 'flex' : 'none';
        
        var modal = document.getElementById('type-modal');
        modal.classList.remove('hidden');
        setTimeout(function() {
            modal.classList.remove('translate-y-full', 'opacity-0');
            modal.classList.add('active'); // CSS should handle backdrop/display
        }, 10);
    }

    window.closeTypeModal = function() {
        var modal = document.getElementById('type-modal');
        modal.classList.remove('active');
        modal.classList.add('translate-y-full', 'opacity-0');
        setTimeout(function() { modal.classList.add('hidden'); }, 300);
        editingTypeId = null;
    };

    function sanitizeIcon(icon) {
        if (!icon) return 'person';
        var slug = icon.toLowerCase().trim();
        
        // Strip Font Awesome prefixes if present
        slug = slug.replace(/^fa-(.*)$/, '$1');
        slug = slug.replace(/^(fa|fas|far|fab|fal|fad|fat|fass)\s+(.*)$/, '$2');
        
        var map = {
            'user': 'person',
            'user-o': 'person_outline',
            'user-circle': 'account_circle',
            'users': 'groups',
            'store': 'storefront',
            'factory': 'domain',
            'home': 'home',
            'credit-card': 'payments',
            'pie-chart': 'analytics',
            'alert-circle': 'error',
            'shopping-cart': 'shopping_cart',
            'briefcase': 'work',
            'book-open': 'menu_book',
            'bank': 'account_balance',
            'university': 'account_balance',
            'landmark': 'account_balance',
            'banknote': 'payments',
            'cash': 'payments',
            'money': 'payments',
            'arrow-up-right': 'trending_up',
            'arrow-down-left': 'trending_down',
            'dollar-sign': 'attach_money',
            'dmark': 'bookmark_manager',
            'trash-2': 'delete',
            'edit': 'edit',
            'plus': 'add'
        };
        return map[slug] || slug;
    }

    document.getElementById('btn-new-type').addEventListener('click', function() { openTypeModal(); });
    document.getElementById('btn-save-type').addEventListener('click', saveType);
    document.getElementById('btn-delete-type').addEventListener('click', function() { deleteType(editingTypeId); });

    function saveType() {
        var data = {
            name: document.getElementById('type-name').value.trim(),
            icon: document.getElementById('type-icon').value.trim()
        };

        if (!data.name) {
            showToast('Group name is required', 'warning');
            return;
        }

        var promise = editingTypeId
            ? api.put('/accounts/types/' + editingTypeId, data)
            : api.post('/accounts/types', data);

        promise
            .then(function() {
                showToast(editingTypeId ? 'Group updated!' : 'Group created!', 'success');
                closeTypeModal();
                loadInitialData(); // Reload everything to update tabs/dropdowns
            })
            .catch(function(err) {
                showToast('Error: ' + err.message, 'error');
            });
    }

    function deleteType(id) {
        showConfirm({
            title: 'Delete Account Group',
            message: 'Are you sure? This cannot be undone.',
            confirmText: 'Delete',
            intent: 'danger'
        }).then(function(confirmed) {
            if (!confirmed) return;
            api.delete('/accounts/types/' + id)
                .then(function() {
                    showToast('Account group deleted', 'success');
                    closeTypeModal();
                    loadInitialData();
                })
                .catch(function(err) {
                    showToast('Error: ' + err.message, 'error');
                });
        });
    }

    // --- Accounts Management ---

    window.filterAccounts = function(btn, type) {
        currentType = type === 'all' ? '' : type;
        var tabs = document.querySelectorAll('.category-tab');
        tabs.forEach(function(t) {
            t.classList.remove('tab-active', 'font-black');
            t.classList.add('text-on-surface-variant', 'font-bold', 'opacity-60');
        });
        btn.classList.add('tab-active', 'font-black');
        btn.classList.remove('text-on-surface-variant', 'font-bold', 'opacity-60');
        loadAccounts();
    };

    function loadAccounts() {
        var container = document.getElementById('accounts-list');
        if (!container) return;
        container.innerHTML = '<div class="loading-overlay"><div class="spinner lg"></div></div>';

        api.get('/accounts', { type: currentType, search: searchInput ? searchInput.value : '' })
            .then(function(accounts) {
                accounts.sort(function(a, b) {
                    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                });
                currentAccountsData = accounts;
                renderAccounts(accounts);
                updateSummaryStats(accounts);
            })
            .catch(function(err) {
                container.innerHTML = '<div class="error-state p-8 text-center text-error font-bold">' + escapeHtml(err.message) + '</div>';
                showToast('Failed to load accounts: ' + err.message, 'error');
            });
    }

    function updateSummaryStats(accounts) {
        var count = accounts.length;
        var receivable = 0;
        var payable = 0;

        accounts.forEach(function(acc) {
            var Bal = parseFloat(acc.current_balance) || 0;
            if (acc.type === 'customer' || acc.type === 'expense' || acc.type === 'cash' || acc.type === 'bank') {
                // Asset convention: + is DR (Receivable)
                if (Bal > 0) receivable += Bal;
                else payable += Math.abs(Bal);
            } else {
                // Liability convention: + is CR (Payable)
                if (Bal > 0) payable += Bal;
                else receivable += Math.abs(Bal);
            }
        });

        document.getElementById('summary-accounts-count').textContent = count;
        document.getElementById('summary-total-receivable').textContent = formatINR(receivable);
        document.getElementById('summary-total-payable').textContent = formatINR(payable);
        document.getElementById('summary-net-balance').textContent = formatINR(receivable - payable);
    }

    function renderAccounts(accounts) {
        var container = document.getElementById('accounts-list');
        
        var html = renderTable(accounts, [
            { label: 'Account Name', key: 'name', render: function(row) {
                var typeObj = allAccountTypes.find(function(t) { return t.slug === row.type; });
                var icon = sanitizeIcon(typeObj ? (typeObj.icon || 'person') : 'person');
                return '<div class="flex items-center gap-4">' +
                            '<div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">' +
                                '<span class="material-symbols-outlined text-lg">' + icon + '</span>' +
                            '</div>' +
                            '<div>' +
                                '<p class="text-sm font-bold text-primary">' + escapeHtml(row.name) + '</p>' +
                                '<p class="text-[10px] text-on-surface-variant uppercase tracking-tighter font-bold opacity-60">' + escapeHtml(row.type) + '</p>' +
                            '</div>' +
                       '</div>';
            }},
            { label: 'Phone', key: 'phone', render: function(row) { return '<span class="text-xs font-medium text-slate-600">' + escapeHtml(row.phone || '—') + '</span>'; } },
            { label: 'Current Balance', key: 'current_balance', align: 'text-right', render: function(row) {
                var balanceStr = formatBalance(row.current_balance, row.type);
                var color = row.current_balance < 0 ? 'text-green-600' : (row.current_balance > 0 ? 'text-error' : 'text-on-surface-variant');
                return '<span class="text-sm font-extrabold ' + color + '">' + balanceStr + '</span>';
            }},
            { label: 'Actions', key: 'id', align: 'text-right', render: function(row) {
                return '<button class="px-4 py-1.5 text-[10px] font-bold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-all uppercase tracking-wider">Ledger</button>';
            }}
        ], { onRowClick: 'viewLedger' });
        
        container.innerHTML = html;
    }

    function renderTypeTabs() {
        var container = document.getElementById('dynamic-type-tabs');
        if (!container) return;
        
        var html = '<button class="category-tab px-4 py-1.5 text-xs font-black uppercase tracking-widest transition-all rounded-xl tab-active" onclick="filterAccounts(this, \'all\')">All Entities</button>';
        
        allAccountTypes.filter(function(t) { return t.is_active; }).forEach(function(t) {
            var icon = sanitizeIcon(t.icon || 'person');
            html += '<button class="category-tab px-4 py-1.5 text-xs font-bold text-on-surface-variant opacity-60 hover:opacity-100 uppercase tracking-widest transition-all hover:bg-surface-container-high rounded-xl flex items-center gap-2 whitespace-nowrap" onclick="filterAccounts(this, \'' + t.slug + '\')">' +
                        '<span class="material-symbols-outlined text-sm">' + icon + '</span>' +
                        escapeHtml(t.name) + 
                    '</button>';
        });
        container.innerHTML = html;
    }

    function updateAccountTypeDropdown() {
        var select = document.getElementById('account-type');
        if (!select) return;
        
        var html = '';
        allAccountTypes.filter(t => t.is_active).forEach(t => {
            html += '<option value="' + t.slug + '">' + escapeHtml(t.name) + '</option>';
        });
        select.innerHTML = html;
    }

    // --- Search ---

    var searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() { loadAccounts(); }, 400));
    }

    // --- Ledger View ---

    window.viewLedger = function(id) {
        window.viewingAccountId = id;
        document.getElementById('accounts-list-view').style.display = 'none';
        document.getElementById('ledger-panel').style.display = 'block';
        document.getElementById('account-list-actions').style.display = 'none';
        
        document.getElementById('ledger-content').innerHTML = '<div class="loading-overlay"><div class="spinner lg"></div></div>';
        
        var dateFrom = document.getElementById('ledger-date-from') ? document.getElementById('ledger-date-from').value : '';
        var dateTo = document.getElementById('ledger-date-to') ? document.getElementById('ledger-date-to').value : '';

        api.get('/reports/account-ledger', { account_id: id, date_from: dateFrom, date_to: dateTo })
            .then(function(data) {
                renderLedger(data);
            })
            .catch(function(err) {
                document.getElementById('ledger-content').innerHTML = '<div class="error-state p-8 text-center text-error font-bold">' + escapeHtml(err.message) + '</div>';
                showToast('Failed to load ledger: ' + err.message, 'error');
            });
    };

    function renderLedger(data) {
        document.getElementById('ledger-account-name').textContent = data.account.name;
        
        var statsHtml = '';
        statsHtml += '<div class="p-6 bg-surface-container-low rounded-xl flex items-center justify-between">' +
                        '<div>' +
                            '<p class="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Opening Balance</p>' +
                            '<p class="text-2xl font-extrabold text-primary tracking-tight">' + formatBalance(data.opening_balance, data.account.type) + '</p>' +
                        '</div>' +
                        '<div class="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">' +
                            '<span class="material-symbols-outlined text-primary">first_page</span>' +
                        '</div>' +
                     '</div>';
        statsHtml += '<div class="p-6 bg-primary rounded-xl flex items-center justify-between text-white">' +
                        '<div>' +
                            '<p class="text-xs font-bold opacity-70 uppercase tracking-widest mb-1">Closing Balance</p>' +
                            '<p class="text-2xl font-extrabold tracking-tight">' + formatBalance(data.closing_balance, data.account.type) + '</p>' +
                        '</div>' +
                        '<div class="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">' +
                            '<span class="material-symbols-outlined">last_page</span>' +
                        '</div>' +
                     '</div>';
        document.getElementById('ledger-stats').innerHTML = statsHtml;

        if (data.transactions && data.transactions.length > 0) {
            document.getElementById('ledger-content').innerHTML = renderTable(data.transactions, [
                { label: 'Date', key: 'date', render: function(row) { return '<span class="text-xs font-bold text-on-surface-variant">' + formatDate(row.date) + '</span>'; } },
                { label: 'Ref / Description', key: 'description', render: function(row) { 
                    var desc = escapeHtml(row.description || 'Entry');
                    if (row.linked_invoice) {
                        desc = '<span class="text-primary font-bold cursor-pointer hover:underline" onclick="event.stopPropagation(); viewInvoice(' + row.linked_sale_id + ')">' + escapeHtml(row.linked_invoice) + '</span> ' + desc;
                    }
                    var subText = row.ref_no || (row.payment_mode ? row.payment_mode.toUpperCase() : '');
                    return '<div>' +
                                '<p class="text-sm font-medium">' + desc + '</p>' +
                                (subText ? '<p class="text-[10px] text-on-surface-variant font-bold opacity-60 uppercase">' + escapeHtml(subText) + '</p>' : '') +
                           '</div>';
                }},
                { label: 'Debit', key: 'amount', align: 'text-right', render: function(row) { 
                    return row.type === 'debit' ? '<span class="text-sm font-extrabold text-error">' + formatINR(row.amount) + '</span>' : '—'; 
                }},
                { label: 'Credit', key: 'amount', align: 'text-right', render: function(row) { 
                    return row.type === 'credit' ? '<span class="text-sm font-extrabold text-green-600">' + formatINR(row.amount) + '</span>' : '—'; 
                }},
                { label: 'Running Balance', key: 'running_balance', align: 'text-right', render: function(row) { 
                    var balanceStr = formatBalance(row.running_balance, data.account.type);
                    return '<span class="text-sm font-extrabold text-primary">' + balanceStr + '</span>'; 
                }}
            ]);
        } else {
            document.getElementById('ledger-content').innerHTML = '<div class="py-20 flex flex-col items-center justify-center text-on-surface-variant">' +
                                                                    '<span class="material-symbols-outlined text-4xl opacity-20 mb-2">history</span>' +
                                                                    '<p class="text-sm font-medium opacity-50">No transactions found</p>' +
                                                                 '</div>';
        }
    }

    window.backToList = function() {
        window.viewingAccountId = null;
        document.getElementById('ledger-panel').style.display = 'none';
        if (currentView === 'types') {
            showTypesView();
        } else {
            showListView();
        }
    };

    // --- Invoice Modal ---

    window.viewInvoice = function(saleId) {
        if (!saleId) return;
        api.get('/sales/' + saleId)
            .then(function(sale) {
                renderInvoiceModal(sale);
            })
            .catch(function(err) {
                showToast('Error loading invoice: ' + err.message, 'error');
            });
    };

    function renderInvoiceModal(sale) {
        var content = document.getElementById('invoice-view-content');
        var html = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="p-4 bg-surface-container-low rounded-xl">
                    <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Invoice No</p>
                    <p class="text-lg font-extrabold text-primary tracking-tight">${escapeHtml(sale.invoice_no)}</p>
                </div>
                <div class="p-4 bg-surface-container-low rounded-xl">
                    <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Date</p>
                    <p class="text-lg font-extrabold text-primary tracking-tight">${formatDate(sale.date)}</p>
                </div>
                <div class="p-4 bg-surface-container-low rounded-xl">
                    <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Ref No</p>
                    <p class="text-lg font-extrabold text-primary tracking-tight">${escapeHtml(sale.ref_no || '—')}</p>
                </div>
            </div>
            <div class="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <p class="text-sm font-bold text-on-surface-variant">Customer: <span class="text-primary">${escapeHtml(sale.customer_name || 'Walk-in')}</span></p>
                    <div>${getStatusBadge(sale.status)}</div>
                </div>
                <div class="flex justify-between items-end border-t border-outline-variant/10 pt-4">
                    <div>
                        <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest leading-none">Total Amount</p>
                        <p class="text-2xl font-black text-primary">${formatINR(sale.total)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest leading-none">Paid Amount</p>
                        <p class="text-xl font-bold text-green-600">${formatINR(sale.amount_paid)}</p>
                    </div>
                </div>
            </div>
            <div class="p-4 border-l-4 border-primary/20 bg-primary/5 rounded-r-xl">
                <p class="text-xs font-bold text-primary uppercase tracking-widest mb-1">Notes</p>
                <p class="text-sm text-on-surface-variant leading-relaxed">${escapeHtml(sale.notes || 'No notes available.')}</p>
            </div>
        `;
        content.innerHTML = html;
        document.getElementById('btn-print-viewed-invoice').onclick = function() { 
            showPrintFormatSelector(function(anonymous) {
                if (anonymous !== null) pdf.generateInvoice(sale, { anonymous: anonymous });
            });
        };
        
        var modal = document.getElementById('invoice-view-modal');
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('opacity-100'), 10);
    }

    window.closeInvoiceModal = function() {
        var modal = document.getElementById('invoice-view-modal');
        modal.classList.remove('opacity-100');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    // --- Account Modal CRUD ---

    function openAccountModal(account) {
        editingAccountId = account ? account.id : null;
        document.getElementById('account-modal-title').textContent = account ? 'Edit Account' : 'New Account';
        document.getElementById('account-name').value = account ? account.name : '';
        document.getElementById('account-type').value = account ? account.type : (allAccountTypes.length > 0 ? allAccountTypes[0].slug : '');
        document.getElementById('account-type').disabled = !!account;
        document.getElementById('account-phone').value = account ? (account.phone || '') : '';
        document.getElementById('account-balance').value = account ? account.opening_balance : 0;
        document.getElementById('account-balance').disabled = !!account;
        
        var btnDelete = document.getElementById('btn-delete-account');
        if (account) {
            btnDelete.style.display = 'flex';
            btnDelete.onclick = function() { deleteAccount(account.id); };
        } else {
            btnDelete.style.display = 'none';
        }
        document.getElementById('account-address').value = account ? (account.address || '') : '';
        document.getElementById('account-notes').value = account ? (account.notes || '') : '';
        
        var modal = document.getElementById('account-modal');
        modal.classList.remove('hidden');
        setTimeout(function() {
            modal.classList.remove('translate-y-full', 'opacity-0');
            modal.classList.add('opacity-100');
        }, 10);
    }

    window.closeAccountModal = function() {
        var modal = document.getElementById('account-modal');
        modal.classList.remove('opacity-100');
        modal.classList.add('translate-y-full', 'opacity-0');
        setTimeout(function() { modal.classList.add('hidden'); }, 300);
        editingAccountId = null;
    };

    document.getElementById('btn-new-account').addEventListener('click', function() { openAccountModal(); });
    document.getElementById('btn-save-account').addEventListener('click', saveAccount);

    function saveAccount() {
        var data = {
            name: document.getElementById('account-name').value.trim(),
            type: document.getElementById('account-type').value,
            phone: document.getElementById('account-phone').value.trim(),
            address: document.getElementById('account-address').value.trim(),
            opening_balance: parseFloat(document.getElementById('account-balance').value) || 0,
            notes: document.getElementById('account-notes').value.trim()
        };

        if (!data.name) {
            showToast('Account name is required', 'warning');
            return;
        }

        var promise = editingAccountId
            ? api.put('/accounts/' + editingAccountId, data)
            : api.post('/accounts', data);

        promise
            .then(function() {
                showToast(editingAccountId ? 'Account updated!' : 'Account created!', 'success');
                closeAccountModal();
                if (window.viewingAccountId) {
                    viewLedger(window.viewingAccountId);
                } else {
                    loadAccounts();
                }
            })
            .catch(function(err) {
                showToast('Error: ' + err.message, 'error');
            });
    }

    window.editAccount = function(id) {
        api.get('/accounts/' + id)
            .then(function(account) {
                openAccountModal(account);
            })
            .catch(function(err) {
                showToast('Error: ' + err.message, 'error');
            });
    };

    window.editCurrentAccount = function() {
        if (!window.viewingAccountId) return;
        editAccount(window.viewingAccountId);
    };

    function deleteAccount(id) {
        showConfirm({
            title: 'Deactivate Account',
            message: 'Are you sure?',
            confirmText: 'Deactivate',
            intent: 'danger'
        }).then(function(confirmed) {
            if (!confirmed) return;
            api.delete('/accounts/' + id)
                .then(function() {
                    showToast('Account deactivated', 'success');
                    if (window.viewingAccountId === id) {
                        backToList();
                    } else {
                        loadAccounts();
                    }
                })
                .catch(function(err) {
                    showToast('Error: ' + err.message, 'error');
                });
        });
    }

    // --- Export & Printing ---

    window.printLedger = function() {
        if (!window.viewingAccountId) return;
        var fullTitle = document.getElementById('ledger-account-name').textContent;
        var accountName = fullTitle.replace('Ledger — ', '').trim();
        var filename = pdf.getSafeFilename(accountName, 'Ledger');
        showPrintFormatSelector(function(anonymous) {
            if (anonymous !== null) pdf.generateReportPDF(document.getElementById('ledger-panel'), fullTitle, filename, { anonymous: anonymous });
        });
    };

    function printAccountsList() {
        if (!currentAccountsData || currentAccountsData.length === 0) {
            showToast('No accounts data to export', 'warning');
            return;
        }
        var title = currentType ? (currentType.toUpperCase() + 's List') : 'Accounts Report';
        var columns = [
            { label: 'Name', key: 'name' },
            { label: 'Group', key: 'type', render: function(row) { return row.type.toUpperCase(); } },
            { label: 'Phone', key: 'phone' },
            { label: 'Balance', key: 'current_balance', align: 'text-right', render: function(row) { return formatBalance(row.current_balance, row.type); } }
        ];
        var filename = pdf.getSafeFilename(currentType ? currentType.toUpperCase() : 'Accounts', 'List');
        showPrintFormatSelector(function(anonymous) {
            if (anonymous !== null) pdf.generateTablePDF(currentAccountsData, columns, title, filename, { anonymous: anonymous });
        });
    }

    if (document.getElementById('btn-print-accounts')) {
        document.getElementById('btn-print-accounts').addEventListener('click', printAccountsList);
    }

})();
