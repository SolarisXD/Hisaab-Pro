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

        // Handle view parameters
        var params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'add') {
            openPaymentModal();
        }
        updateSidebarActiveState();
    });

    function updateSidebarActiveState() {
        var params = new URLSearchParams(window.location.search);
        var view = params.get('view') || 'list';
        
        var paymentsNav = document.querySelector('.nav-link[data-page="payments"]');
        if (!paymentsNav) return;
        
        var subMenu = paymentsNav.nextElementSibling;
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

    document.getElementById('btn-new-payment').addEventListener('click', openPaymentModal);
    document.getElementById('btn-save-payment').addEventListener('click', savePayment);

    var btnPrintList = document.getElementById('btn-print-list');
    if (btnPrintList) btnPrintList.addEventListener('click', function() {
        printPaymentsList();
    });

    var currentPaymentsData = [];

    var searchInput = document.getElementById('search-input');
    var filterMode = document.getElementById('filter-mode');
    var filterDateFrom = document.getElementById('filter-date-from');
    var filterDateTo = document.getElementById('filter-date-to');

    var fy = getFinancialYearDates();
    var today = getToday();
    if (filterDateFrom && !filterDateFrom.value) filterDateFrom.value = fy.start;
    if (filterDateTo && !filterDateTo.value) filterDateTo.value = today;

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
            currentPaymentsData = payments;
            renderPayments(payments);
        })
        .catch(function(err) {
            var container = document.getElementById('payments-list');
            if (container) container.innerHTML = '<div class="error-state p-8 text-center text-error font-bold flex items-center justify-center gap-2"><span class="material-symbols-outlined">error</span> ' + escapeHtml(err.message) + '</div>';
            showToast('Failed to load payments: ' + err.message, 'error');
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
            { label: 'Invoice', key: 'sale_invoice_no', render: function(row) {
                if (!row.sale_invoice_no) return '<span class="opacity-40">—</span>';
                var badge = row.sale_status === 'paid' ? 'badge-success' : 
                         row.sale_status === 'partial' ? 'badge-warning' : 'badge-neutral';
                return '<span class="badge ' + badge + '">' + escapeHtml(row.sale_invoice_no) + '</span>';
            }},
            { label: 'Status', key: 'sale_status', render: function(row) {
                if (!row.sale_status) return '<span class="opacity-40">—</span>';
                var label = row.sale_status === 'paid' ? 'Full' : 
                         row.sale_status === 'partial' ? 'Partial' : 'Pending';
                var cls = row.sale_status === 'paid' ? 'text-green-600' : 
                         row.sale_status === 'partial' ? 'text-amber-600' : 'text-gray-500';
                return '<span class="' + cls + ' font-medium">' + label + '</span>';
            }},
            { label: 'Ref No', key: 'ref_no', render: function(row) { return escapeHtml(row.ref_no || '—'); } },
            { label: 'Reference', key: 'reference', render: function(row) { return escapeHtml(row.reference || '—'); } },
            { label: '', key: 'actions', render: function(row) {
                return '<button class="btn btn-ghost btn-sm" onclick="deletePayment(' + row.id + ')" style="color:var(--color-danger);" title="Delete"><span class="material-symbols-outlined" style="font-size:18px;">delete</span></button>';
            }}
        ]);
    }

    function loadAccounts() {
        api.get('/accounts').then(function(accounts) {
            window._allAccounts = accounts;
            loadAccountsForType('in');
        }).catch(function() {});
    }

    function loadAccountsForType(type) {
        var select = document.getElementById('payment-account');
        var currentValue = select.value;
        select.innerHTML = '<option value="">Select account</option>';
        var accounts = window._allAccounts || [];
        
        // Sort accounts by type then name
        accounts.sort(function(a, b) {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return a.name.localeCompare(b.name);
        });

        for (var i = 0; i < accounts.length; i++) {
            var option = document.createElement('option');
            option.value = accounts[i].id;
            // Show type in uppercase for clarity
            var displayType = accounts[i].type.charAt(0).toUpperCase() + accounts[i].type.slice(1);
            option.textContent = accounts[i].name + ' (' + displayType + ')';
            select.appendChild(option);
        }
        
        // Restore value if it still exists
        if (currentValue) select.value = currentValue;
    }

    function openPaymentModal() {
        var dateEl = document.getElementById('payment-date');
        var fy = getFinancialYearDates();
        dateEl.min = fy.start;
        dateEl.max = fy.end;
        var today = getToday();
        dateEl.value = (today >= fy.start && today <= fy.end ? today : fy.start);
        
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

        showConfirm({
            title: 'Record Payment',
            message: 'Are you sure you want to record this ' + (data.type === 'in' ? 'received' : 'paid out') + ' payment of ' + formatINR(data.amount) + '?',
            confirmText: 'Record Payment',
            intent: 'primary'
        }).then(function(confirmed) {
            if (!confirmed) return;

            api.post('/payments', data)
                .then(function() {
                    showToast('Payment recorded successfully!', 'success');
                    closePaymentModal();
                    loadPayments();
                })
                .catch(function(err) {
                    showToast('Error: ' + err.message, 'error');
                });
        });
    }

    window.deletePayment = function(id) {
        showConfirm({
            title: 'Delete Payment',
            message: 'Are you sure you want to delete this payment record?',
            confirmText: 'Delete',
            intent: 'danger'
        }).then(function(confirmed) {
            if (!confirmed) return;
            api.delete('/payments/' + id)
                .then(function() {
                    showToast('Payment deleted', 'success');
                    loadPayments();
                })
                .catch(function(err) {
                    showToast('Error: ' + err.message, 'error');
                });
        });
    };

    function printPaymentsList() {
        if (!currentPaymentsData || currentPaymentsData.length === 0) {
            showToast('No payments data to export', 'warning');
            return;
        }

        var columns = [
            { label: 'Date', key: 'date', render: (row) => formatDate(row.date) },
            { label: 'Account', key: 'account_name' },
            { label: 'Type', key: 'type', render: (row) => row.type === 'in' ? 'Received' : 'Paid Out' },
            { label: 'Mode', key: 'mode', render: (row) => getPaymentModeLabel(row.mode) },
            { label: 'Amount', key: 'amount', align: 'text-right', render: (row) => pdf.formatAmount(row.amount) },
            { label: 'Ref No', key: 'ref_no' },
            { label: 'Reference', key: 'reference' }
        ];

        var filename = pdf.getSafeFilename('Payments', 'Report');
        pdf.generateReportPDF(currentPaymentsData, columns, 'Payments Report', { filename: filename });
    }
})();
