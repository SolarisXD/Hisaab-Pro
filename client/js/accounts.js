/**
 * accounts.js — Hisaab Pro Accounts Page Controller
 */

'use strict';

(function() {
    var currentType = '';
    var currentView = 'list';
    var editingAccountId = null;
    var editingTypeId = null;
    var viewingAccountId = null;
    var allAccountTypes = [];
    var currentAccountsData = [];

    checkAuth().then(function(user) {
        if (!user) return;
        loadCommonUI();
        
        // Handle view from URL
        var params = new URLSearchParams(window.location.search);
        currentView = params.get('view') || 'list';
        
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
                updateSidebarActiveState();
            })
            .catch(function(err) {
                showToast('Failed to load account types: ' + err.message, 'error');
            });
    }

    function updateSidebarActiveState() {
        var subLinks = document.querySelectorAll('.nav-sub-link');
        subLinks.forEach(link => {
            var href = link.getAttribute('href');
            if (href.includes('view=' + currentView)) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    // --- Navigation & View Switching ---

    function showListView() {
        currentView = 'list';
        document.getElementById('accounts-list-view').style.display = 'block';
        document.getElementById('account-types-view').style.display = 'none';
        document.getElementById('ledger-panel').style.display = 'none';
        document.getElementById('account-list-actions').style.display = 'flex';
        document.getElementById('account-types-actions').style.display = 'none';
        loadAccounts();
    }

    function showTypesView() {
        currentView = 'types';
        document.getElementById('accounts-list-view').style.display = 'none';
        document.getElementById('account-types-view').style.display = 'block';
        document.getElementById('ledger-panel').style.display = 'none';
        document.getElementById('account-list-actions').style.display = 'none';
        document.getElementById('account-types-actions').style.display = 'flex';
        loadAccountTypes();
    }

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
                container.innerHTML = '<div class="error-state"><i data-lucide="alert-circle"></i><p>' + escapeHtml(err.message) + '</p></div>';
                lucide.createIcons();
            });
    }

    function renderAccountTypes(types) {
        var container = document.getElementById('account-types-list');
        var html = renderTable(types, [
            { label: 'Name', key: 'name', render: function(row) {
                var icon = row.icon || 'user';
                return '<span style="font-weight:600;"><i data-lucide="' + icon + '" style="width:14px; height:14px; vertical-align:middle; margin-right:8px;"></i>' + escapeHtml(row.name) + '</span>';
            }},
            { label: 'Slug', key: 'slug', render: function(row) { return '<code>' + row.slug + '</code>'; } },
            { label: 'System', key: 'is_system', render: function(row) { 
                return row.is_system ? '<span class="badge badge-primary">System</span>' : '<span class="badge">Custom</span>';
            }},
            { label: 'Status', key: 'is_active', render: function(row) {
                return row.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>';
            }}
        ], { onRowClick: 'editType' });
        
        container.innerHTML = html;
        lucide.createIcons();
    }

    window.editType = function(id) {
        var type = allAccountTypes.find(t => t.id === id);
        if (type) openTypeModal(type);
    };

    function openTypeModal(type) {
        editingTypeId = type ? type.id : null;
        document.getElementById('type-modal-title').textContent = type ? 'Edit Account Group' : 'New Account Group';
        document.getElementById('type-name').value = type ? type.name : '';
        document.getElementById('type-icon').value = type ? (type.icon || 'user') : 'user';
        
        document.getElementById('btn-delete-type').style.display = (type && !type.is_system) ? 'flex' : 'none';
        document.getElementById('type-modal').classList.add('active');
    }

    window.closeTypeModal = function() {
        document.getElementById('type-modal').classList.remove('active');
        editingTypeId = null;
    };

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
        currentType = type;
        var tabs = document.querySelectorAll('.tab');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
        btn.classList.add('active');
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
            })
            .catch(function(err) {
                container.innerHTML = '<div class="error-state"><i data-lucide="alert-circle"></i><p>' + escapeHtml(err.message) + '</p></div>';
                showToast('Failed to load accounts: ' + err.message, 'error');
                lucide.createIcons();
            });
    }

    function renderAccounts(accounts) {
        var container = document.getElementById('accounts-list');
        
        var typeIcons = {};
        allAccountTypes.forEach(t => {
            typeIcons[t.slug] = '<i data-lucide="' + (t.icon || 'user') + '" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i>';
        });

        var html = renderTable(accounts, [
            { label: 'Name', key: 'name', render: function(row) {
                return '<span style="font-weight:600;">' + (typeIcons[row.type] || '') + ' ' + escapeHtml(row.name) + '</span>';
            }},
            { label: 'Group', key: 'type', render: function(row) {
                return '<span class="badge badge-primary" style="text-transform:capitalize;">' + row.type + '</span>';
            }},
            { label: 'Phone', key: 'phone', render: function(row) { return escapeHtml(row.phone || '—'); } },
            { label: 'Balance', key: 'current_balance', align: 'text-right', render: function(row) {
                var cls = row.current_balance > 0 ? 'negative' : (row.current_balance < 0 ? 'positive' : '');
                return '<span class="amount ' + cls + '">' + formatBalance(row.current_balance, row.type) + '</span>';
            }}
        ], { onRowClick: 'viewLedger' });
        
        container.innerHTML = html;
        lucide.createIcons();
    }

    function renderTypeTabs() {
        var container = document.getElementById('dynamic-type-tabs');
        if (!container) return;
        
        var html = '';
        allAccountTypes.filter(t => t.is_active).forEach(t => {
            html += '<button class="tab" onclick="filterAccounts(this, \'' + t.slug + '\')"><i data-lucide="' + (t.icon || 'user') + '" style="width:14px; height:14px;"></i> ' + escapeHtml(t.name) + 's</button>';
        });
        container.innerHTML = html;
        lucide.createIcons();
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
        viewingAccountId = id;
        document.getElementById('accounts-list-view').style.display = 'none';
        document.getElementById('ledger-panel').style.display = 'block';
        document.getElementById('account-list-actions').style.display = 'none';
        
        document.getElementById('ledger-content').innerHTML = '<div class="loading-overlay"><div class="spinner lg"></div></div>';
        
        api.get('/reports/account-ledger', { account_id: id })
            .then(function(data) {
                renderLedger(data);
            })
            .catch(function(err) {
                document.getElementById('ledger-content').innerHTML = '<div class="error-state"><i data-lucide="alert-circle"></i><p>' + escapeHtml(err.message) + '</p></div>';
                showToast('Failed to load ledger: ' + err.message, 'error');
            });
    };

    function renderLedger(data) {
        document.getElementById('ledger-account-name').textContent = 'Ledger — ' + data.account.name;
        
        var statsHtml = '<div class="stats-row" style="margin-bottom:20px;">';
        statsHtml += '<div class="stat-card primary"><div class="stat-label">Opening Balance</div><div class="stat-value">' + formatBalance(data.opening_balance, data.account.type) + '</div></div>';
        statsHtml += '<div class="stat-card" style="background:var(--color-surface); border:1px solid var(--color-border);"><div class="stat-label">Closing Balance</div><div class="stat-value" style="color:var(--color-primary);">' + formatBalance(data.closing_balance, data.account.type) + '</div></div>';
        statsHtml += '</div>';
        document.getElementById('ledger-stats').innerHTML = statsHtml;

        if (data.transactions && data.transactions.length > 0) {
            document.getElementById('ledger-content').innerHTML = renderTable(data.transactions, [
                { label: 'Date', key: 'date', render: function(row) { return formatDate(row.date); } },
                { label: 'Ref No', key: 'ref_no', render: function(row) { return escapeHtml(row.ref_no || '—'); } },
                { label: 'Description', key: 'description', render: function(row) { 
                    var desc = escapeHtml(row.description || 'Entry');
                    if (row.linked_invoice) {
                        desc += ' <a class="invoice-link" onclick="event.stopPropagation(); viewInvoice(' + row.linked_sale_id + ')"> (Inv: ' + escapeHtml(row.linked_invoice) + ')</a>';
                    }
                    if (row.payment_mode) {
                        desc += ' <small style="opacity:0.6;">[' + escapeHtml(row.payment_mode.toUpperCase()) + ']</small>';
                    }
                    return desc;
                }},
                { label: 'Debit', key: 'amount', align: 'text-right', render: function(row) { 
                    return row.type === 'debit' ? '<span class="amount negative">' + formatINR(row.amount) + '</span>' : '—'; 
                }},
                { label: 'Credit', key: 'amount', align: 'text-right', render: function(row) { 
                    return row.type === 'credit' ? '<span class="amount positive">' + formatINR(row.amount) + '</span>' : '—'; 
                }},
                { label: 'Balance', key: 'running_balance', align: 'text-right', render: function(row) { 
                    return '<strong>' + formatBalance(row.running_balance, data.account.type) + '</strong>'; 
                }}
            ]);
        } else {
            document.getElementById('ledger-content').innerHTML = '<div class="empty-state"><p>No transactions found</p></div>';
        }
        lucide.createIcons();
    }

    window.backToList = function() {
        viewingAccountId = null;
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
            <div class="stats-row" style="margin-bottom:20px;">
                <div class="stat-card primary"><div class="stat-label">Invoice No</div><div class="stat-value">${escapeHtml(sale.invoice_no)}</div></div>
                <div class="stat-card"><div class="stat-label">Date</div><div class="stat-value">${formatDate(sale.date)}</div></div>
                <div class="stat-card"><div class="stat-label">Ref No</div><div class="stat-value">${escapeHtml(sale.ref_no || '—')}</div></div>
            </div>
            <div class="panel" style="margin-bottom:15px;">
                <div class="panel-body">
                    <p><strong>Customer:</strong> ${escapeHtml(sale.customer_name || 'Walk-in')}</p>
                    <p><strong>Total Amount:</strong> <span class="amount">${formatINR(sale.total)}</span></p>
                    <p><strong>Amount Paid:</strong> <span class="amount">${formatINR(sale.amount_paid)}</span></p>
                    <p><strong>Status:</strong> ${getStatusBadge(sale.status)}</p>
                </div>
            </div>
            <p><strong>Notes:</strong> ${escapeHtml(sale.notes || '—')}</p>
        `;
        content.innerHTML = html;
        document.getElementById('btn-print-viewed-invoice').onclick = function() { pdf.generateInvoice(sale); };
        document.getElementById('invoice-view-modal').classList.add('active');
        lucide.createIcons();
    }

    window.closeInvoiceModal = function() {
        document.getElementById('invoice-view-modal').classList.remove('active');
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
        document.getElementById('account-modal').classList.add('active');
    }

    window.closeAccountModal = function() {
        document.getElementById('account-modal').classList.remove('active');
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
                if (viewingAccountId) {
                    viewLedger(viewingAccountId);
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
        if (!viewingAccountId) return;
        editAccount(viewingAccountId);
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
                    if (viewingAccountId === id) {
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
        if (!viewingAccountId) return;
        var fullTitle = document.getElementById('ledger-account-name').textContent;
        var accountName = fullTitle.replace('Ledger — ', '').trim();
        var filename = pdf.getSafeFilename(accountName, 'Ledger');
        pdf.generateReportPDF(document.getElementById('ledger-panel'), fullTitle, filename);
    };

    function printAccountsList() {
        if (!currentAccountsData || currentAccountsData.length === 0) {
            showToast('No accounts data to print', 'warning');
            return;
        }
        var title = currentType ? (currentType.toUpperCase() + 's List') : 'Accounts Report';
        var columns = [
            { label: 'Name', key: 'name' },
            { label: 'Group', key: 'type', render: (row) => row.type.toUpperCase() },
            { label: 'Phone', key: 'phone' },
            { label: 'Balance', key: 'current_balance', align: 'text-right', render: (row) => formatBalance(row.current_balance, row.type) }
        ];
        var filename = pdf.getSafeFilename(currentType ? currentType.toUpperCase() : 'Accounts', 'List');
        pdf.generateTablePDF(currentAccountsData, columns, title, filename);
    }

    if (document.getElementById('btn-print-accounts')) {
        document.getElementById('btn-print-accounts').addEventListener('click', printAccountsList);
    }

})();
