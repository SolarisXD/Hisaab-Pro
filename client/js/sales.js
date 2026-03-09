/**
 * sales.js — Hisaab Pro Sales Page Controller
 */

'use strict';

(function() {
    var editingSaleId = null;

    checkAuth().then(function(user) {
        if (!user) return;
        loadCommonUI();
        loadSales();
        loadCustomers();
    });

    // New Sale button
    document.getElementById('btn-new-sale').addEventListener('click', function() {
        openSaleModal();
    });

    // Save sale button
    var btnSave = document.getElementById('btn-save-sale');
    if (btnSave) btnSave.addEventListener('click', function() {
        saveSale();
    });

    // Auto-calculating Ref No (Book-Page)
    function fetchNextRefNo() {
        if (editingSaleId) return;
        api.getNextRefNo().then(function(data) {
            if (data && data.next_ref_no) {
                document.getElementById('sale-ref-no').value = data.next_ref_no;
            }
        }).catch(function() {});
    }

    // Fetch next Invoice No
    function fetchNextInvoiceNo() {
        if (editingSaleId) return;
        api.getNextInvoiceNo().then(function(data) {
            if (data && data.next_invoice_no) {
                document.getElementById('sale-invoice-no').value = data.next_invoice_no;
            }
        }).catch(function() {});
    }

    // Search and filter
    var searchInput = document.getElementById('search-input');
    var filterStatus = document.getElementById('filter-status');
    var filterDateFrom = document.getElementById('filter-date-from');
    var filterDateTo = document.getElementById('filter-date-to');

    var debouncedSearch = debounce(function() { loadSales(); }, 400);
    if (searchInput) searchInput.addEventListener('input', debouncedSearch);
    if (filterStatus) filterStatus.addEventListener('change', function() { loadSales(); });
    if (filterDateFrom) filterDateFrom.addEventListener('change', function() { loadSales(); });
    if (filterDateTo) filterDateTo.addEventListener('change', function() { loadSales(); });

    function loadSales() {
        var container = document.getElementById('sales-list');
        if (!container) return;

        var params = {
            search: searchInput ? searchInput.value : '',
            status: (filterStatus && filterStatus.value) || '',
            date_from: (filterDateFrom && filterDateFrom.value) || '',
            date_to: (filterDateTo && filterDateTo.value) || '',
            limit: 50
        };

        api.get('/sales', params)
            .then(function(sales) {
                renderSalesList(sales);
            })
            .catch(function(err) {
                var container = document.getElementById('sales-list');
                if (container) container.innerHTML = '<div class="error-state"><i data-lucide="alert-circle"></i><p>' + escapeHtml(err.message) + '</p></div>';
                showToast('Failed to load sales: ' + err.message, 'error');
                lucide.createIcons();
            });
    }

    function renderSalesList(sales) {
        var container = document.getElementById('sales-list');
        container.innerHTML = renderTable(sales, [
            { label: 'Invoice No', key: 'invoice_no', render: function(row) {
                return '<span style="font-weight:600; color: var(--color-primary);">' + escapeHtml(row.invoice_no) + '</span>';
            }},
            { label: 'Ref No', key: 'ref_no', render: function(row) {
                return '<span class="text-muted">' + escapeHtml(row.ref_no || '—') + '</span>';
            }},
            { label: 'Date', key: 'date', render: function(row) { return formatDate(row.date); } },
            { label: 'Customer', key: 'customer_name', render: function(row) { return escapeHtml(row.customer_name || 'Walk-in'); } },
            { label: 'Total', key: 'total', align: 'text-right', render: function(row) {
                return '<span class="amount">' + formatINR(row.total) + '</span>';
            }},
            { label: 'Paid', key: 'amount_paid', align: 'text-right', render: function(row) {
                return '<span class="amount">' + formatINR(row.amount_paid) + '</span>';
            }},
            { label: 'Status', key: 'status', render: function(row) { return getStatusBadge(row.status); } }
        ], { onRowClick: 'editSale' });
        lucide.createIcons();
    }

    function loadCustomers() {
        api.get('/accounts', { type: 'customer' })
            .then(function(accounts) {
                var select = document.getElementById('sale-customer');
                for (var i = 0; i < accounts.length; i++) {
                    var option = document.createElement('option');
                    option.value = accounts[i].id;
                    option.textContent = accounts[i].name;
                    select.appendChild(option);
                }
            })
            .catch(function() {});
    }

    function openSaleModal(sale) {
        editingSaleId = sale ? sale.id : null;
        document.getElementById('sale-modal-title').textContent = sale ? 'Edit Sale' : 'New Sale';
        document.getElementById('sale-date').value = sale ? sale.date : getToday();
        document.getElementById('sale-customer').value = sale ? (sale.customer_account_id || '') : '';
        document.getElementById('sale-total').value = sale ? sale.total : '';
        document.getElementById('sale-invoice-no').value = sale ? sale.invoice_no : 'Generating...';
        document.getElementById('sale-ref-no').value = sale ? (sale.ref_no || '') : 'Generating...';
        document.getElementById('sale-tax-percent').value = sale ? sale.tax_percent : 18;
        document.getElementById('sale-amount-paid').value = sale ? sale.amount_paid : 0;
        document.getElementById('sale-notes').value = sale ? (sale.notes || '') : '';

        if (!sale) {
            fetchNextRefNo();
            fetchNextInvoiceNo();
        }

        document.getElementById('sale-modal').classList.add('active');
        
        var btnDownload = document.getElementById('btn-download-sale');
        var btnDelete = document.getElementById('btn-delete-sale');
        
        if (sale) {
            btnDownload.style.display = 'flex';
            btnDownload.onclick = function() { pdf.generateInvoice(sale); };
            
            btnDelete.style.display = 'flex';
            btnDelete.onclick = function() { deleteSale(sale.id); };
        } else {
            btnDownload.style.display = 'none';
            btnDelete.style.display = 'none';
        }
    }

    window.closeSaleModal = function() {
        document.getElementById('sale-modal').classList.remove('active');
        editingSaleId = null;
    };


    function saveSale() {
        var total = parseFloat(document.getElementById('sale-total').value);
        if (isNaN(total) || total <= 0) {
            showToast('Please enter a valid amount', 'warning');
            return;
        }

        var data = {
            date: document.getElementById('sale-date').value,
            customer_account_id: document.getElementById('sale-customer').value || null,
            total: total,
            ref_no: document.getElementById('sale-ref-no').value,
            tax_percent: parseFloat(document.getElementById('sale-tax-percent').value),
            amount_paid: parseFloat(document.getElementById('sale-amount-paid').value) || 0,
            notes: document.getElementById('sale-notes').value
        };

        showConfirm({
            title: editingSaleId ? 'Update Sale' : 'Create Sale',
            message: 'Are you sure you want to ' + (editingSaleId ? 'save changes to' : 'create') + ' this sale?',
            confirmText: editingSaleId ? 'Save Changes' : 'Create Sale',
            intent: 'primary'
        }).then(function(confirmed) {
            if (!confirmed) return;

            var promise = editingSaleId
                ? api.put('/sales/' + editingSaleId, data)
                : api.post('/sales', data);

            promise
                .then(function(sale) {
                    showToast(editingSaleId ? 'Sale updated!' : 'Sale created: ' + sale.invoice_no, 'success');
                    closeSaleModal();
                    loadSales();
                })
                .catch(function(err) {
                    showToast('Error: ' + err.message, 'error');
                });
        });
    }

    // Global functions for onclick handlers
    window.viewSale = function(id) {
        api.get('/sales/' + id)
            .then(function(sale) {
                openSaleModal(sale);
            })
            .catch(function(err) {
                showToast('Error loading sale: ' + err.message, 'error');
            });
    };

    window.editSale = function(id) {
        api.get('/sales/' + id)
            .then(function(sale) {
                openSaleModal(sale);
            })
            .catch(function(err) {
                showToast('Error loading sale: ' + err.message, 'error');
            });
    };

    window.downloadInvoice = function(id) {
        api.get('/sales/' + id)
            .then(function(sale) {
                pdf.generateInvoice(sale);
            })
            .catch(function(err) {
                showToast('Error loading invoice: ' + err.message, 'error');
            });
    };

    window.deleteSale = function(id) {
        showConfirm({
            title: 'Delete Sale',
            message: 'Are you sure you want to delete this sale? This action cannot be undone.',
            confirmText: 'Delete',
            intent: 'danger'
        }).then(function(confirmed) {
            if (!confirmed) return;
            api.delete('/sales/' + id)
                .then(function() {
                    showToast('Sale deleted', 'success');
                    loadSales();
                })
                .catch(function(err) {
                    showToast('Error: ' + err.message, 'error');
                });
        });
    };
})();
