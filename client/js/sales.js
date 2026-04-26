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
        
        // Handle view parameters
        var params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'add') {
            openSaleModal();
        }
        updateSidebarActiveState();
    });

    function updateSidebarActiveState() {
        var links = document.querySelectorAll('#sidebar [data-page]');
        links.forEach(function(link) {
            if (link.getAttribute('data-page') === 'sales') {
                link.classList.add('sidebar-active');
                link.classList.remove('text-slate-600', 'hover:bg-[#e4e2e1]/50');
                // Set icon to filled
                var icon = link.querySelector('.material-symbols-outlined');
                if (icon) icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                link.classList.remove('sidebar-active');
            }
        });
    }

    // New Sale button
    document.getElementById('btn-new-sale').addEventListener('click', function() {
        openSaleModal();
    });

    // Save sale button
    var btnSave = document.getElementById('btn-save-sale');
    if (btnSave) btnSave.addEventListener('click', function() {
        saveSale();
    });

    // Print List button
    var btnPrintList = document.getElementById('btn-print-list');
    if (btnPrintList) btnPrintList.addEventListener('click', function() {
        printSalesList();
    });

    var currentSalesData = [];

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

    var fy = getFinancialYearDates();
    var today = getToday();
    if (filterDateFrom && !filterDateFrom.value) filterDateFrom.value = fy.start;
    if (filterDateTo && !filterDateTo.value) filterDateTo.value = today;

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
                currentSalesData = sales;
                renderSalesList(sales);
            })
            .catch(function(err) {
                var container = document.getElementById('sales-list');
                if (container) container.innerHTML = '<div class="error-state p-8 text-center text-error font-bold flex items-center justify-center gap-2"><span class="material-symbols-outlined">error</span> ' + escapeHtml(err.message) + '</div>';
                showToast('Failed to load sales: ' + err.message, 'error');
            });
    }

    function renderSalesList(sales) {
        var container = document.getElementById('sales-list');
        container.innerHTML = renderTable(sales, [
            { label: 'Invoice Details', key: 'invoice_no', render: function(row) {
                return '<div class="flex items-center gap-4">' +
                            '<div class="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">' +
                                '<span class="material-symbols-outlined text-primary">receipt_long</span>' +
                            '</div>' +
                            '<div>' +
                                '<p class="text-sm font-bold text-primary">' + escapeHtml(row.invoice_no) + '</p>' +
                                '<p class="text-[10px] text-on-surface-variant uppercase tracking-tighter">' + escapeHtml(row.ref_no || 'No Ref') + '</p>' +
                            '</div>' +
                       '</div>';
            }},
            { label: 'Date', key: 'date', render: function(row) { return formatDate(row.date); } },
            { label: 'Customer', key: 'customer_name', render: function(row) { 
                var name = row.customer_name || 'Walk-in Customer';
                var initial = name.charAt(0).toUpperCase();
                return '<div class="flex items-center gap-3">' +
                            '<div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-[10px] font-bold text-on-secondary-container">' + initial + '</div>' +
                            '<span class="text-sm font-medium">' + escapeHtml(name) + '</span>' +
                       '</div>';
            }},
            { label: 'Total', key: 'total', align: 'text-right', render: function(row) {
                return '<span class="font-bold text-primary">' + formatINR(row.total) + '</span>';
            }},
            { label: 'Paid', key: 'amount_paid', align: 'text-right', render: function(row) {
                var color = row.amount_paid >= row.total ? 'text-green-600' : 'text-on-surface-variant';
                return '<span class="font-medium ' + color + '">' + formatINR(row.amount_paid) + '</span>';
            }},
            { label: 'Status', key: 'status', render: function(row) { return getStatusBadge(row.status); } }
        ], { onRowClick: 'editSale' });
        
        // Remove lucide call as we use Material Symbols now
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
        
        var dateEl = document.getElementById('sale-date');
        var fy = getFinancialYearDates();
        dateEl.min = fy.start;
        dateEl.max = fy.end;
        var today = getToday();
        dateEl.value = sale ? sale.date : (today >= fy.start && today <= fy.end ? today : fy.start);
        
        document.getElementById('sale-customer').value = sale ? (sale.customer_account_id || '') : '';
        document.getElementById('sale-total').value = sale ? sale.total : '';
        document.getElementById('sale-invoice-no').value = sale ? sale.invoice_no : 'Generating...';
        document.getElementById('sale-ref-no').value = sale ? (sale.ref_no || '') : 'Generating...';
        document.getElementById('sale-amount-paid').value = sale ? sale.amount_paid : 0;
        document.getElementById('sale-notes').value = sale ? (sale.notes || '') : '';

        var existingImages = sale && sale.images ? sale.images : [];
        document.getElementById('sale-images-data').value = JSON.stringify(existingImages);
        renderImagePreviews(existingImages, 'sale');

        if (!sale) {
            fetchNextRefNo();
            fetchNextInvoiceNo();
        }

        document.getElementById('sale-modal').classList.add('active');
        
        var btnDownload = document.getElementById('btn-download-sale');
        var btnDelete = document.getElementById('btn-delete-sale');
        
        if (sale) {
            btnDownload.style.display = 'flex';
            btnDownload.onclick = function() { 
                showPrintFormatSelector(function(anonymous) {
                    if (anonymous !== null) pdf.generateInvoice(sale, { anonymous: anonymous, type: 'sale' });
                });
            };
            
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

    function resetSaleModalForNext() {
        var form = document.getElementById('sale-form');
        if (form) form.reset();
        
        // Robust reset for select and other fields
        var customerSelect = document.getElementById('sale-customer');
        if (customerSelect) {
            customerSelect.value = '';
            customerSelect.selectedIndex = 0;
        }
        
        var dateEl = document.getElementById('sale-date');
        var fy = getFinancialYearDates();
        var today = getToday();
        dateEl.value = (today >= fy.start && today <= fy.end ? today : fy.start);
        
        document.getElementById('sale-amount-paid').value = 0;
        document.getElementById('sale-notes').value = '';
        
        document.getElementById('sale-images-data').value = '[]';
        var preview = document.getElementById('sale-images-preview');
        if (preview) preview.innerHTML = '';
        
        editingSaleId = null;
        fetchNextRefNo();
        fetchNextInvoiceNo();
        
        // Small delay to ensure focus works after form reset
        setTimeout(function() {
            document.getElementById('sale-total').focus();
        }, 50);
    }


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
            tax_percent: 0,
            tax_amount: 0,
            amount_paid: parseFloat(document.getElementById('sale-amount-paid').value) || 0,
            notes: document.getElementById('sale-notes').value,
            images: JSON.parse(document.getElementById('sale-images-data').value || '[]')
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
                    if (editingSaleId) {
                        closeSaleModal();
                    } else {
                        resetSaleModalForNext();
                    }
                    loadSales();
                })
                .catch(function(err) {
                    showToast('Error: ' + err.message, 'error');
                });
        });
    }

    // --- Image Upload Handlers ---
    var saleImagesInput = document.getElementById('sale-images');
    if (saleImagesInput) {
        saleImagesInput.addEventListener('change', function(e) {
            handleImageUpload(e.target.files, 'sale');
            e.target.value = ''; // Reset input
        });
    }

    function handleImageUpload(files, prefix) {
        if (!files || files.length === 0) return;
        var formData = new FormData();
        for (var i = 0; i < files.length; i++) {
            formData.append('images', files[i]);
        }
        
        showToast('Uploading images...', 'info');
        api.uploadBills(formData).then(function(res) {
            if (res.success && res.urls) {
                var currentData = JSON.parse(document.getElementById(prefix + '-images-data').value || '[]');
                currentData = currentData.concat(res.urls);
                document.getElementById(prefix + '-images-data').value = JSON.stringify(currentData);
                renderImagePreviews(currentData, prefix);
                showToast('Images uploaded successfully', 'success');
            }
        }).catch(function(err) {
            showToast('Upload failed: ' + err.message, 'error');
        });
    }

    window.removeImage = function(index, prefix) {
        var el = document.getElementById(prefix + '-images-data');
        var currentData = JSON.parse(el.value || '[]');
        currentData.splice(index, 1);
        el.value = JSON.stringify(currentData);
        renderImagePreviews(currentData, prefix);
    };

    function renderImagePreviews(urls, prefix) {
        var container = document.getElementById(prefix + '-images-preview');
        if (!container) return;
        container.innerHTML = '';
        
        // Update file count label
        var label = document.getElementById(prefix + '-images-label');
        if (label) {
            var countEl = label.querySelector('.file-count');
            if (countEl) {
                if (urls.length > 0) {
                    countEl.textContent = urls.length + (urls.length === 1 ? ' file' : ' files');
                    countEl.style.display = 'inline-block';
                } else {
                    countEl.style.display = 'none';
                }
            }
        }

        urls.forEach(function(url, index) {
            var div = document.createElement('div');
            div.style.position = 'relative';
            div.style.display = 'inline-block';
            div.innerHTML = '<a href="' + url + '" target="_blank" style="display:block;"><img src="' + url + '" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid var(--color-border);"/></a>' +
                            '<button type="button" onclick="removeImage(' + index + ', \'' + prefix + '\')" style="position: absolute; top: -8px; right: -8px; background: var(--color-danger); color: white; border: none; border-radius: 12px; width: 24px; height: 24px; font-size: 14px; cursor: pointer; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">✕</button>';
            container.appendChild(div);
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
                showPrintFormatSelector(function(anonymous) {
                    if (anonymous !== null) pdf.generateInvoice(sale, { anonymous: anonymous });
                });
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

    function hideSalesFilter() { document.getElementById('filter-panel').classList.add('hidden'); }
    
    function printSalesList() {
        if (!currentSalesData || currentSalesData.length === 0) {
            showToast('No sales data to export', 'warning');
            return;
        }

        var columns = [
            { label: 'Invoice No', key: 'invoice_no' },
            { label: 'Ref No', key: 'ref_no' },
            { label: 'Date', key: 'date', render: (row) => formatDate(row.date) },
            { label: 'Customer', key: 'customer_name', render: (row) => row.customer_name || 'Walk-in' },
            { label: 'Total', key: 'total', align: 'text-right', render: (row) => formatINR(row.total) },
            { label: 'Status', key: 'status', render: (row) => row.status.toUpperCase() }
        ];

        var filename = pdf.getSafeFilename('Sales', 'Report');
        showPrintFormatSelector(function(anonymous) {
            if (anonymous !== null) pdf.generateTablePDF(currentSalesData, columns, 'Sales Report', filename, { anonymous: anonymous });
        });
    }
})();
