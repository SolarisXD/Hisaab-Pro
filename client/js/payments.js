/**
 * payments.js — Hisaab Pro Payments Page Controller
 */

'use strict';

(function() {
    var currentType = '';

    checkAuth().then(function(user) {
        if (!user) return;
        loadCommonUI();
        loadPayments();
        loadAccounts();
    });

    document.getElementById('btn-new-payment').addEventListener('click', openPaymentModal);
    document.getElementById('btn-save-payment').addEventListener('click', savePayment);

    var searchInput = document.getElementById('search-input');
    var filterMode = document.getElementById('filter-mode');
    var filterDateFrom = document.getElementById('filter-date-from');
    var filterDateTo = document.getElementById('filter-date-to');

    var debouncedSearch = debounce(function() { loadPayments(); }, 400);
    if (searchInput) searchInput.addEventListener('input', debouncedSearch);
    if (filterMode) filterMode.addEventListener('change', function() { loadPayments(); });
    if (filterDateFrom) filterDateFrom.addEventListener('change', function() { loadPayments(); });
    if (filterDateTo) filterDateTo.addEventListener('change', function() { loadPayments(); });

    // Dynamic account loading based on type
    document.getElementById('payment-type').addEventListener('change', function() {
        loadAccountsForType(this.value);
    });

    window.filterByType = function(btn, type) {
        currentType = type;
        var tabs = document.querySelectorAll('.tab');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
        btn.classList.add('active');
        loadPayments();
    };

    function loadPayments() {
        var container = document.getElementById('payments-list');
        if (!container) return;

        api.get('/payments', {
            search: searchInput ? searchInput.value : '',
            type: currentType,
            mode: (filterMode && filterMode.value) || '',
            date_from: (filterDateFrom && filterDateFrom.value) || '',
            date_to: (filterDateTo && filterDateTo.value) || '',
            limit: 50
        })
        .then(function(payments) {
            renderPayments(payments);
        })
        .catch(function(err) {
            var container = document.getElementById('payments-list');
            if (container) container.innerHTML = '<div class="error-state"><i data-lucide="alert-circle"></i><p>' + escapeHtml(err.message) + '</p></div>';
            showToast('Failed to load payments: ' + err.message, 'error');
            lucide.createIcons();
        });
    }

    function renderPayments(payments) {
        var container = document.getElementById('payments-list');
        container.innerHTML = renderTable(payments, [
            { label: 'Date', key: 'date', render: function(row) { return formatDate(row.date); } },
            { label: 'Account', key: 'account_name', render: function(row) { return escapeHtml(row.account_name); } },
            { label: 'Type', key: 'type', render: function(row) {
                return row.type === 'in'
                    ? '<span class="badge badge-success">Received</span>'
                    : '<span class="badge badge-warning">Paid Out</span>';
            }},
            { label: 'Mode', key: 'mode', render: function(row) { return getPaymentModeLabel(row.mode); } },
            { label: 'Amount', key: 'amount', align: 'text-right', render: function(row) {
                var cls = row.type === 'in' ? 'positive' : 'negative';
                return '<span class="amount ' + cls + '">' + formatINR(row.amount) + '</span>';
            }},
            { label: 'Reference', key: 'reference', render: function(row) { return escapeHtml(row.reference || '—'); } },
            { label: '', key: 'actions', render: function(row) {
                return '<button class="btn btn-ghost btn-sm" onclick="deletePayment(' + row.id + ')" style="color:var(--color-danger);" title="Delete"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>';
            }}
        ]);
        lucide.createIcons();
    }

    function loadAccounts() {
        api.get('/accounts').then(function(accounts) {
            window._allAccounts = accounts;
            loadAccountsForType('in');
        }).catch(function() {});
    }

    function loadAccountsForType(type) {
        var select = document.getElementById('payment-account');
        select.innerHTML = '<option value="">Select account</option>';
        var accounts = window._allAccounts || [];
        var filterType = type === 'in' ? 'customer' : 'supplier';

        for (var i = 0; i < accounts.length; i++) {
            if (accounts[i].type === filterType || accounts[i].type === 'cash' || accounts[i].type === 'bank' || accounts[i].type === 'expense') {
                var option = document.createElement('option');
                option.value = accounts[i].id;
                option.textContent = accounts[i].name + ' (' + accounts[i].type + ')';
                select.appendChild(option);
            }
        }
    }

    function openPaymentModal() {
        document.getElementById('payment-date').value = getToday();
        document.getElementById('payment-amount').value = '';
        document.getElementById('payment-reference').value = '';
        document.getElementById('payment-notes').value = '';
        document.getElementById('payment-type').value = 'in';
        document.getElementById('payment-mode').value = 'cash';
        loadAccountsForType('in');
        document.getElementById('payment-modal').classList.add('active');
    }

    window.closePaymentModal = function() {
        document.getElementById('payment-modal').classList.remove('active');
    };

    function savePayment() {
        var data = {
            date: document.getElementById('payment-date').value,
            account_id: parseInt(document.getElementById('payment-account').value),
            amount: parseFloat(document.getElementById('payment-amount').value),
            type: document.getElementById('payment-type').value,
            mode: document.getElementById('payment-mode').value,
            reference: document.getElementById('payment-reference').value,
            notes: document.getElementById('payment-notes').value
        };

        if (!data.account_id || !data.amount) {
            showToast('Please fill in all required fields', 'warning');
            return;
        }

        api.post('/payments', data)
            .then(function() {
                showToast('Payment recorded successfully!', 'success');
                closePaymentModal();
                loadPayments();
            })
            .catch(function(err) {
                showToast('Error: ' + err.message, 'error');
            });
    }

    window.deletePayment = function(id) {
        if (!confirm('Delete this payment?')) return;
        api.delete('/payments/' + id)
            .then(function() {
                showToast('Payment deleted', 'success');
                loadPayments();
            })
            .catch(function(err) {
                showToast('Error: ' + err.message, 'error');
            });
    };
})();
