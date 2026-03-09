/**
 * purchases.js — Hisaab Pro Purchases Page Controller
 */

'use strict';

(function() {
    var editingPurchaseId = null;

    checkAuth().then(function(user) {
        if (!user) return;
        loadCommonUI();
        loadPurchases();
        loadSuppliers();
    });

    // New Purchase button
    document.getElementById('btn-new-purchase').addEventListener('click', function() {
        openPurchaseModal();
    });

    // Save purchase button
    var btnSave = document.getElementById('btn-save-purchase');
    if (btnSave) btnSave.addEventListener('click', function() {
        savePurchase();
    });

    // Search and filter
    var searchInput = document.getElementById('search-input');
    var filterStatus = document.getElementById('filter-status');
    var filterDateFrom = document.getElementById('filter-date-from');
    var filterDateTo = document.getElementById('filter-date-to');

    var debouncedSearch = debounce(function() { loadPurchases(); }, 400); 
    if (searchInput) searchInput.addEventListener('input', debouncedSearch);
    if (filterStatus) filterStatus.addEventListener('change', function() { loadPurchases(); });
    if (filterDateFrom) filterDateFrom.addEventListener('change', function() { loadPurchases(); });
    if (filterDateTo) filterDateTo.addEventListener('change', function() { loadPurchases(); });

    function loadPurchases() {
        var container = document.getElementById('purchases-list');
        if (!container) return;

        var params = {
            search: searchInput ? searchInput.value : '',
            status: (filterStatus && filterStatus.value) || '',
            date_from: (filterDateFrom && filterDateFrom.value) || '',
            date_to: (filterDateTo && filterDateTo.value) || '',
            limit: 50
        };

        api.getPurchases(params)
            .then(function(purchases) {
                renderPurchasesList(purchases);
            })
            .catch(function(err) {
                var container = document.getElementById('purchases-list');
                if (container) container.innerHTML = '<div class="error-state"><i data-lucide="alert-circle"></i><p>' + escapeHtml(err.message) + '</p></div>';
                showToast('Failed to load purchases: ' + err.message, 'error');
                lucide.createIcons();
            });
    }

    function renderPurchasesList(purchases) {
        var container = document.getElementById('purchases-list');
        container.innerHTML = renderTable(purchases, [
            { label: 'Bill No', key: 'invoice_no', render: function(row) {
                return '<span style="font-weight:600; color: var(--color-primary);">' + escapeHtml(row.invoice_no) + '</span>';
            }},
            { label: 'Date', key: 'date', render: function(row) { return formatDate(row.date); } },
            { label: 'Supplier', key: 'supplier_name', render: function(row) { return escapeHtml(row.supplier_name || 'Generic'); } },
            { label: 'Total', key: 'total', align: 'text-right', render: function(row) {
                return '<span class="amount">' + formatINR(row.total) + '</span>';
            }},
            { label: 'Paid', key: 'amount_paid', align: 'text-right', render: function(row) {
                return '<span class="amount">' + formatINR(row.amount_paid) + '</span>';
            }},
            { label: 'Status', key: 'status', render: function(row) { return getStatusBadge(row.status); } }
        ], { onRowClick: 'editPurchase' });
        lucide.createIcons();
    }

    function loadSuppliers() {
        api.get('/accounts', { type: 'supplier' })
            .then(function(accounts) {
                var select = document.getElementById('purchase-supplier');
                for (var i = 0; i < accounts.length; i++) {
                    var option = document.createElement('option');
                    option.value = accounts[i].id;
                    option.textContent = accounts[i].name;
                    select.appendChild(option);
                }
            })
            .catch(function() {});
    }

    function openPurchaseModal(purchase) {
        editingPurchaseId = purchase ? purchase.id : null;
        document.getElementById('purchase-modal-title').textContent = purchase ? 'Edit Purchase' : 'New Purchase';
        document.getElementById('purchase-invoice-no').value = purchase ? purchase.invoice_no : '';
        document.getElementById('purchase-date').value = purchase ? purchase.date : getToday();
        document.getElementById('purchase-supplier').value = purchase ? (purchase.supplier_account_id || '') : '';
        document.getElementById('purchase-total').value = purchase ? purchase.total : '';
        document.getElementById('purchase-ref-no').value = purchase ? (purchase.ref_no || '') : '';
        document.getElementById('purchase-amount-paid').value = purchase ? purchase.amount_paid : 0;
        document.getElementById('purchase-notes').value = purchase ? (purchase.notes || '') : '';

        var btnDelete = document.getElementById('btn-delete-purchase');
        if (purchase) {
            btnDelete.style.display = 'flex';
            btnDelete.onclick = function() { deletePurchase(purchase.id); };
        } else {
            btnDelete.style.display = 'none';
        }

        document.getElementById('purchase-modal').classList.add('active');
    }

    window.closePurchaseModal = function() {
        document.getElementById('purchase-modal').classList.remove('active');
        editingPurchaseId = null;
    };

    function savePurchase() {
        var invoiceNo = document.getElementById('purchase-invoice-no').value.trim();
        var total = parseFloat(document.getElementById('purchase-total').value);

        if (!invoiceNo) {
            showToast('Please enter bill number', 'warning');
            return;
        }
        if (isNaN(total) || total <= 0) {
            showToast('Please enter a valid amount', 'warning');
            return;
        }

        var data = {
            invoice_no: invoiceNo,
            date: document.getElementById('purchase-date').value,
            supplier_account_id: document.getElementById('purchase-supplier').value || null,
            total: total,
            ref_no: document.getElementById('purchase-ref-no').value,
            amount_paid: parseFloat(document.getElementById('purchase-amount-paid').value) || 0,
            notes: document.getElementById('purchase-notes').value
        };

        showConfirm({
            title: editingPurchaseId ? 'Update Purchase' : 'Record Purchase',
            message: 'Are you sure you want to ' + (editingPurchaseId ? 'save changes to' : 'record') + ' this purchase bill?',
            confirmText: editingPurchaseId ? 'Save Changes' : 'Record Purchase',
            intent: 'primary'
        }).then(function(confirmed) {
            if (!confirmed) return;

            var promise = editingPurchaseId
                ? api.put('/purchases/' + editingPurchaseId, data)
                : api.createPurchase(data);

            promise
                .then(function(purchase) {
                    showToast(editingPurchaseId ? 'Purchase updated!' : 'Purchase recorded!', 'success');
                    closePurchaseModal();
                    loadPurchases();
                })
                .catch(function(err) {
                    showToast('Error: ' + err.message, 'error');
                });
        });
    }

    window.viewPurchase = function(id) {
        api.getPurchase(id)
            .then(function(purchase) {
                openPurchaseModal(purchase);
            })
            .catch(function(err) {
                showToast('Error loading purchase: ' + err.message, 'error');
            });
    };

    window.editPurchase = function(id) {
        api.getPurchase(id)
            .then(function(purchase) {
                openPurchaseModal(purchase);
            })
            .catch(function(err) {
                showToast('Error loading purchase: ' + err.message, 'error');
            });
    };

    window.deletePurchase = function(id) {
        showConfirm({
            title: 'Delete Purchase',
            message: 'Are you sure you want to delete this purchase bill? This action cannot be undone.',
            confirmText: 'Delete',
            intent: 'danger'
        }).then(function(confirmed) {
            if (!confirmed) return;
            api.deletePurchase(id)
                .then(function() {
                    showToast('Purchase deleted', 'success');
                    loadPurchases();
                })
                .catch(function(err) {
                    showToast('Error: ' + err.message, 'error');
                });
        });
    };
})();
