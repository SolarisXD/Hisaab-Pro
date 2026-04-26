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

        // Handle view parameters
        var params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'add') {
            openPurchaseModal();
        }
        updateSidebarActiveState();
    });

    function updateSidebarActiveState() {
        var links = document.querySelectorAll('#sidebar [data-page]');
        links.forEach(function(link) {
            if (link.getAttribute('data-page') === 'purchases') {
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

    // New Purchase button
    document.getElementById('btn-new-purchase').addEventListener('click', function() {
        openPurchaseModal();
    });

    // Save purchase button
    var btnSave = document.getElementById('btn-save-purchase');
    if (btnSave) btnSave.addEventListener('click', function() {
        savePurchase();
    });

    // Print List button
    var btnPrintList = document.getElementById('btn-print-list');
    if (btnPrintList) btnPrintList.addEventListener('click', function() {
        printPurchasesList();
    });

    var currentPurchasesData = [];

    // Search and filter
    var searchInput = document.getElementById('search-input');
    var filterStatus = document.getElementById('filter-status');
    var filterDateFrom = document.getElementById('filter-date-from');
    var filterDateTo = document.getElementById('filter-date-to');

    var fy = getFinancialYearDates();
    var today = getToday();
    if (filterDateFrom && !filterDateFrom.value) filterDateFrom.value = fy.start;
    if (filterDateTo && !filterDateTo.value) filterDateTo.value = today;

    var debouncedSearch = debounce(function() { loadPurchases(); }, 400); 
    if (searchInput) searchInput.addEventListener('input', debouncedSearch);
    if (filterStatus) filterStatus.addEventListener('change', function() { loadPurchases(); });
    if (filterDateFrom) filterDateFrom.addEventListener('change', function() { loadPurchases(); });
    if (filterDateTo) filterDateTo.addEventListener('change', function() { loadPurchases(); });

    // Auto-calculate total for purchases
    var purchaseSubtotal = document.getElementById('purchase-subtotal');
    var purchaseTaxPercent = document.getElementById('purchase-tax-percent');
    var purchaseTotal = document.getElementById('purchase-total');

    function calculatePurchaseTotal() {
        var subtotal = parseFloat(purchaseSubtotal.value) || 0;
        var taxPercent = parseFloat(purchaseTaxPercent.value) || 0;
        var total = subtotal + (subtotal * taxPercent / 100);
        purchaseTotal.value = total.toFixed(2);
    }

    if (purchaseSubtotal) purchaseSubtotal.addEventListener('input', calculatePurchaseTotal);
    if (purchaseTaxPercent) purchaseTaxPercent.addEventListener('change', calculatePurchaseTotal);

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
                currentPurchasesData = purchases;
                renderPurchasesList(purchases);
            })
            .catch(function(err) {
                var container = document.getElementById('purchases-list');
                if (container) container.innerHTML = '<div class="error-state p-8 text-center text-error font-bold flex items-center justify-center gap-2"><span class="material-symbols-outlined">error</span> ' + escapeHtml(err.message) + '</div>';
                showToast('Failed to load purchases: ' + err.message, 'error');
            });
    }

    function renderPurchasesList(purchases) {
        var container = document.getElementById('purchases-list');
        container.innerHTML = renderTable(purchases, [
            { label: 'Bill Details', key: 'invoice_no', render: function(row) {
                return '<div class="flex items-center gap-4">' +
                            '<div class="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">' +
                                '<span class="material-symbols-outlined text-primary">receipt_long</span>' +
                            '</div>' +
                            '<div>' +
                                '<p class="text-sm font-bold text-primary">' + escapeHtml(row.invoice_no) + '</p>' +
                                '<p class="text-[10px] text-on-surface-variant uppercase tracking-tighter">' + formatDate(row.date) + '</p>' +
                            '</div>' +
                       '</div>';
            }},
            { label: 'Supplier', key: 'supplier_name', render: function(row) { 
                var name = row.supplier_name || 'Generic Supplier';
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
        ], { onRowClick: 'editPurchase' });
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
        
        var dateEl = document.getElementById('purchase-date');
        var fy = getFinancialYearDates();
        dateEl.min = fy.start;
        dateEl.max = fy.end;
        var today = getToday();
        dateEl.value = purchase ? purchase.date : (today >= fy.start && today <= fy.end ? today : fy.start);
        
        document.getElementById('purchase-supplier').value = purchase ? (purchase.supplier_account_id || '') : '';
        document.getElementById('purchase-subtotal').value = purchase ? (purchase.subtotal || purchase.total) : '';
        document.getElementById('purchase-tax-percent').value = purchase ? (purchase.tax_percent || 0) : 0;
        document.getElementById('purchase-total').value = purchase ? purchase.total : '';
        document.getElementById('purchase-amount-paid').value = purchase ? purchase.amount_paid : 0;
        document.getElementById('purchase-notes').value = purchase ? (purchase.notes || '') : '';

        var existingImages = purchase && purchase.images ? purchase.images : [];
        document.getElementById('purchase-images-data').value = JSON.stringify(existingImages);
        renderImagePreviews(existingImages, 'purchase');

        var btnDownload = document.getElementById('btn-download-purchase');
        var btnDelete = document.getElementById('btn-delete-purchase');
        
        if (purchase) {
            if (btnDelete) {
                btnDelete.style.display = 'flex';
                btnDelete.onclick = function() { deletePurchase(purchase.id); };
            }
            
            if (btnDownload) {
                btnDownload.style.display = 'flex';
                btnDownload.onclick = function() {
                    showPrintFormatSelector(function(anonymous) {
                        if (anonymous !== null) pdf.generateInvoice(purchase, { anonymous: anonymous, type: 'purchase' });
                    });
                };
            }
        } else {
            if (btnDelete) btnDelete.style.display = 'none';
            if (btnDownload) btnDownload.style.display = 'none';
        }

        document.getElementById('purchase-modal').classList.add('active');
    }

    window.closePurchaseModal = function() {
        document.getElementById('purchase-modal').classList.remove('active');
        editingPurchaseId = null;

        var form = document.getElementById('purchase-form');
        if (form) form.reset();
        
        var imagesData = document.getElementById('purchase-images-data');
        if(imagesData) imagesData.value = '[]';
        var preview = document.getElementById('purchase-images-preview');
        if (preview) preview.innerHTML = '';
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

        var subtotal = parseFloat(document.getElementById('purchase-subtotal').value) || 0;
        var taxPercent = parseFloat(document.getElementById('purchase-tax-percent').value) || 0;
        var taxAmount = subtotal * taxPercent / 100;
        var total = subtotal + taxAmount;

        var data = {
            invoice_no: invoiceNo,
            date: document.getElementById('purchase-date').value,
            supplier_account_id: document.getElementById('purchase-supplier').value || null,
            subtotal: subtotal,
            tax_percent: taxPercent,
            tax_amount: taxAmount,
            total: total,
            amount_paid: parseFloat(document.getElementById('purchase-amount-paid').value) || 0,
            notes: document.getElementById('purchase-notes').value,
            images: JSON.parse(document.getElementById('purchase-images-data').value || '[]')
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

    // --- Image Upload Handlers ---
    var purchaseImagesInput = document.getElementById('purchase-images');
    if (purchaseImagesInput) {
        purchaseImagesInput.addEventListener('change', function(e) {
            handleImageUpload(e.target.files, 'purchase');
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

    function printPurchasesList() {
        if (!currentPurchasesData || currentPurchasesData.length === 0) {
            showToast('No purchases data to export', 'warning');
            return;
        }

        var columns = [
            { label: 'Bill No', key: 'invoice_no' },
            { label: 'Date', key: 'date', render: (row) => formatDate(row.date) },
            { label: 'Supplier', key: 'supplier_name', render: (row) => row.supplier_name || 'Generic' },
            { label: 'Total', key: 'total', align: 'text-right', render: (row) => formatINR(row.total) },
            { label: 'Paid', key: 'amount_paid', align: 'text-right', render: (row) => formatINR(row.amount_paid) },
            { label: 'Status', key: 'status', render: (row) => row.status.toUpperCase() }
        ];

        var filename = pdf.getSafeFilename('Purchases', 'Report');
        showPrintFormatSelector(function(anonymous) {
            if (anonymous !== null) pdf.generateTablePDF(currentPurchasesData, columns, 'Purchases Report', filename, { anonymous: anonymous });
        });
    }
})();
