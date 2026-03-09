/**
 * accounts.js — Hisaab Pro Accounts Page Controller
 */

'use strict';

(function() {
    var currentType = '';
    var editingAccountId = null;

    checkAuth().then(function(user) {
        if (!user) return;
        loadCommonUI();
        loadAccounts();
    });

    document.getElementById('btn-new-account').addEventListener('click', function() { openAccountModal(); });
    document.getElementById('btn-save-account').addEventListener('click', saveAccount);

    var searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() { loadAccounts(); }, 400));
    }

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

        api.get('/accounts', { type: currentType, search: searchInput ? searchInput.value : '' })
            .then(function(accounts) {
                renderAccounts(accounts);
            })
            .catch(function(err) {
                var container = document.getElementById('accounts-list');
                if (container) container.innerHTML = '<div class="error-state"><i data-lucide="alert-circle"></i><p>' + escapeHtml(err.message) + '</p></div>';
                showToast('Failed to load accounts: ' + err.message, 'error');
                lucide.createIcons();
            });
    }

    function renderAccounts(accounts) {
        var container = document.getElementById('accounts-list');

        var typeIcons = {
            customer: '<i data-lucide="user" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i>',
            supplier: '<i data-lucide="factory" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i>',
            cash: '<i data-lucide="banknote" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i>',
            bank: '<i data-lucide="landmark" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i>',
            expense: '<i data-lucide="arrow-up-right" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i>',
            revenue: '<i data-lucide="arrow-down-left" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i>'
        };

        var html = renderTable(accounts, [
            { label: 'Name', key: 'name', render: function(row) {
                return '<span style="font-weight:600;">' + (typeIcons[row.type] || '') + ' ' + escapeHtml(row.name) + '</span>';
            }},
            { label: 'Type', key: 'type', render: function(row) {
                return '<span class="badge badge-primary" style="text-transform:capitalize;">' + row.type + '</span>';
            }},
            { label: 'Phone', key: 'phone', render: function(row) { return escapeHtml(row.phone || '—'); } },
            { label: 'Balance', key: 'current_balance', align: 'text-right', render: function(row) {
                var cls = row.current_balance > 0 ? 'negative' : (row.current_balance < 0 ? 'positive' : '');
                return '<span class="amount ' + cls + '">' + formatINR(row.current_balance) + '</span>';
            }}
        ], { onRowClick: 'editAccount' });
        
        container.innerHTML = html;
        lucide.createIcons();
    }

    function openAccountModal(account) {
        editingAccountId = account ? account.id : null;
        document.getElementById('account-modal-title').textContent = account ? 'Edit Account' : 'New Account';
        document.getElementById('account-name').value = account ? account.name : '';
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

    function saveAccount() {
        var data = {
            name: document.getElementById('account-name').value.trim(),
            type: document.getElementById('account-type').value,
            // account_group removed as per user request
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
                loadAccounts();
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

    window.deleteAccount = function(id) {
        if (!confirm('Deactivate this account?')) return;
        api.delete('/accounts/' + id)
            .then(function() {
                showToast('Account deactivated', 'success');
                loadAccounts();
            })
            .catch(function(err) {
                showToast('Error: ' + err.message, 'error');
            });
    };

    window.viewTransactions = function(id, name) {
        api.get('/accounts/' + id + '/transactions', { limit: 20 })
            .then(function(transactions) {
                var html = '<h3 style="margin-bottom:16px;">Transactions — ' + escapeHtml(name) + '</h3>';
                html += renderTable(transactions, [
                    { label: 'Date', key: 'date', render: function(row) { return formatDate(row.date); } },
                    { label: 'Type', key: 'type', render: function(row) {
                        return row.type === 'credit'
                            ? '<span class="badge badge-success">Credit</span>'
                            : '<span class="badge badge-danger">Debit</span>';
                    }},
                    { label: 'Amount', key: 'amount', align: 'text-right', render: function(row) {
                        return '<span class="amount">' + formatINR(row.amount) + '</span>';
                    }},
                    { label: 'Description', key: 'description', render: function(row) { return escapeHtml(row.description || ''); } }
                ]);

                // Show in a modal-like overlay
                var overlay = document.createElement('div');
                overlay.className = 'modal-overlay active';
                overlay.innerHTML = '<div class="modal modal-lg"><div class="modal-header"><h3>Transaction History</h3><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div><div class="modal-body">' + html + '</div></div>';
                document.body.appendChild(overlay);
            })
            .catch(function(err) {
                showToast('Error: ' + err.message, 'error');
            });
    };
})();
