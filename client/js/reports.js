/**
 * reports.js — Hisaab Pro Reports Page Controller
 */

'use strict';

(function() {
    checkAuth().then(function(user) {
        if (!user) return;
        loadCommonUI();
        updateSidebarActiveState();
    });

    function updateSidebarActiveState() {
        var links = document.querySelectorAll('#sidebar [data-page]');
        links.forEach(function(link) {
            if (link.getAttribute('data-page') === 'reports') {
                link.classList.add('sidebar-active');
                link.classList.remove('text-slate-600', 'hover:bg-[#e4e2e1]/50');
                var icon = link.querySelector('.material-symbols-outlined');
                if (icon) icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                link.classList.remove('sidebar-active');
            }
        });
    }

    // Toggle sidebar
    var sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            var sidebar = document.getElementById('sidebar');
            var overlay = document.getElementById('sidebar-overlay');
            sidebar.classList.toggle('-translate-x-full');
            overlay.classList.toggle('hidden');
        });
    }
    
    var sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            var sidebar = document.getElementById('sidebar');
            sidebar.classList.add('-translate-x-full');
            sidebarOverlay.classList.add('hidden');
        });
    }

    var reportType = document.getElementById('report-type');
    var reportDate = document.getElementById('report-date');
    var reportMonth = document.getElementById('report-month');
    var reportAsOfDate = document.getElementById('report-as-of-date');
    var reportAccount = document.getElementById('report-account');
    var reportDateFrom = document.getElementById('report-date-from');
    var reportDateTo = document.getElementById('report-date-to');
    var filterWrapper = document.getElementById('filter-wrapper');
    var btnExportOptions = document.getElementById('btn-export-options');
    var exportModal = document.getElementById('export-modal');
    var btnGenerate = document.getElementById('btn-generate');
    var currentReportData = null;
    var currentReportType = '';

    // Verify all critical elements exist
    if (!reportType || !btnGenerate) {
        console.error('Critical report elements missing from DOM');
        return;
    }

    // Set defaults
    var fy = getFinancialYearDates();
    var today = getToday();
    if (reportDate) reportDate.value = today;
    if (reportMonth) reportMonth.value = getCurrentMonth();
    if (reportAsOfDate) reportAsOfDate.value = today;
    if (reportDateFrom) reportDateFrom.value = fy.start;
    if (reportDateTo) reportDateTo.value = fy.end;

    // Load accounts for ledger
    api.get('/accounts').then(function(accounts) {
        accounts.forEach(function(acc) {
            var opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = acc.name + ' (' + acc.type + ')';
            reportAccount.appendChild(opt);
        });
    });

    // Toggle filters based on report type
    window.switchReport = function(type) {
        reportType.value = type;
        
        // Update tab active state
        var tabs = document.querySelectorAll('.report-nav-tab');
        tabs.forEach(tab => {
            if (tab.getAttribute('data-type') === type) {
                tab.classList.add('bg-primary/10', 'text-primary');
                tab.classList.remove('text-on-surface-variant');
            } else {
                tab.classList.remove('bg-primary/10', 'text-primary');
                tab.classList.add('text-on-surface-variant');
            }
        });

        // Hide all results when switching
        document.getElementById('report-panel').classList.add('hidden');
        document.getElementById('report-initial-state').classList.remove('hidden');
        currentReportData = null;

        // Reset visibility groups
        document.getElementById('single-date-group').classList.add('hidden');
        document.getElementById('month-group').classList.add('hidden');
        document.getElementById('as-of-date-group').classList.add('hidden');
        document.getElementById('account-select-group').classList.add('hidden');
        document.getElementById('date-range-group').classList.add('hidden');

        // Show appropriate groups
        if (type === 'daily-sales') {
            document.getElementById('single-date-group').classList.remove('hidden');
        } else if (type === 'monthly') {
            document.getElementById('month-group').classList.remove('hidden');
        } else if (type === 'account-ledger') {
            document.getElementById('account-select-group').classList.remove('hidden');
            document.getElementById('date-range-group').classList.remove('hidden');
        } else if (['debtor-aging', 'creditor-schedule', 'balance-sheet', 'amount-receivable'].includes(type)) {
            var asOfGroup = document.getElementById('as-of-date-group');
            if (asOfGroup) asOfGroup.classList.remove('hidden');
            generateReport(); // Load immediately with default date
        }
    };

    btnGenerate.addEventListener('click', generateReport);
    
    if (btnExportOptions) {
        btnExportOptions.addEventListener('click', function() {
            exportModal.classList.remove('hidden');
            setTimeout(() => exportModal.classList.add('opacity-100'), 10);
        });
    }

    window.closeExportModal = function() {
        exportModal.classList.remove('opacity-100');
        setTimeout(() => exportModal.classList.add('hidden'), 300);
    };

    var btnPrintReport = document.getElementById('btn-print-report');
    if (btnPrintReport) {
        btnPrintReport.addEventListener('click', function() {
            var title = (document.getElementById('report-results-title').textContent || 'Report').trim();
            var cleanTitle = title.replace(/[^a-z0-9 ]/gi, '').replace(/\s+/g, ' ');
            var filename = pdf.getSafeFilename(cleanTitle, 'Report');
            showPrintFormatSelector(function(anonymous) {
                if (anonymous !== null) pdf.generateReportPDF(document.getElementById('report-content'), title, filename, { anonymous: anonymous });
            });
        });
    }

    var btnExportPdf = document.getElementById('btn-export-pdf');
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', function() {
            var title = (document.getElementById('report-results-title').textContent || 'Report').trim();
            var cleanTitle = title.replace(/[^a-z0-9 ]/gi, '').replace(/\s+/g, ' ');
            var filename = pdf.getSafeFilename(cleanTitle, 'Report');
            showPrintFormatSelector(function(anonymous) {
                if (anonymous !== null) {
                    pdf.generateReportPDF(document.getElementById('report-content'), title, filename, { anonymous: anonymous });
                    closeExportModal();
                }
            });
        });
    }

    window.openGalleryModal = function(encodedUrls) {
        var urls = [];
        try {
            urls = JSON.parse(decodeURIComponent(encodedUrls));
        } catch(e) {}
        
        var container = document.getElementById('gallery-container');
        container.innerHTML = '';
        urls.forEach(function(url) {
            container.innerHTML += '<a href="' + url + '" target="_blank"><img src="' + url + '" style="max-width: 100%; border-radius: 4px; border: 1px solid var(--color-border);"/></a>';
        });
        document.getElementById('gallery-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('gallery-modal').classList.add('opacity-100'), 10);
    };

    window.closeGalleryModal = function() {
        var modal = document.getElementById('gallery-modal');
        modal.classList.remove('opacity-100');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };

    var btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', function() {
            if (!currentReportData) return;
            var titleEl = document.getElementById('report-results-title');
            var title = (titleEl ? titleEl.textContent : 'Report') || 'Report';
            var filename = title.replace(/[^a-z0-9]/gi, '_') + '.csv';
            
            // Flatten data for CSV if needed
            var exportData = [];
            if (currentReportType === 'daily-sales') exportData = currentReportData.sales;
            else if (currentReportType === 'account-ledger') exportData = currentReportData.transactions;
            else if (currentReportType === 'debtor-aging') exportData = currentReportData.buckets['0-30'].concat(currentReportData.buckets['30-60']).concat(currentReportData.buckets['60+']);
            else if (currentReportType === 'amount-receivable') exportData = currentReportData.customers;
            else if (currentReportType === 'creditor-schedule') exportData = currentReportData.creditors;
            else {
                showToast('Export for this report type is pending optimization', 'info');
                return;
            }

            downloadCSV(exportData, filename);
            closeExportModal();
        });
    }

    function generateReport() {
        var type = reportType.value;
        var params = {};
        var endpoint = '/reports/' + type;

        if (type === 'daily-sales') {
            params.date = reportDate.value;
        } else if (type === 'monthly') {
            params.month = reportMonth.value;
        } else if (type === 'account-ledger') {
            params.accountId = reportAccount.value;
            params.from = reportDateFrom.value;
            params.to = reportDateTo.value;
        } else if (['debtor-aging', 'creditor-schedule', 'balance-sheet', 'amount-receivable'].includes(type)) {
            params.date = reportAsOfDate.value;
        }

        btnGenerate.disabled = true;
        btnGenerate.textContent = 'Analyzing Ledger...';
        
        // Show loading state in content area
        var contentEl = document.getElementById('report-content');
        if (contentEl) contentEl.innerHTML = '<div class="py-40 text-center flex flex-col items-center gap-6"><div class="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div><p class="text-xs font-black uppercase tracking-[0.4em] text-primary animate-pulse">Navigating Fiscal Matrix</p></div>';

        api.get(endpoint, params)
            .then(function(data) {
                currentReportData = data;
                currentReportType = type;
                renderReport(type, data);
                
                document.getElementById('report-initial-state').classList.add('hidden');
                document.getElementById('report-panel').classList.remove('hidden');
                
                btnGenerate.disabled = false;
                btnGenerate.textContent = 'Extract Data';
            })
            .catch(function(err) {
                var contentEl = document.getElementById('report-content');
                if (contentEl) contentEl.innerHTML = '<div class="py-20 text-center text-error font-bold flex flex-col items-center gap-2"><span class="material-symbols-outlined text-4xl">warning</span><p>' + escapeHtml(err.message) + '</p></div>';
                showToast('Error generating report: ' + err.message, 'error');
                btnGenerate.disabled = false;
                btnGenerate.textContent = 'Generate Report';
            });
    }

    function renderReport(type, data) {
        var titleEl = document.getElementById('report-results-title');
        var contentEl = document.getElementById('report-content');
        var timestampEl = document.getElementById('report-timestamp');
        if (timestampEl) timestampEl.textContent = new Date().toLocaleString();

        switch (type) {
            case 'daily-sales':
                titleEl.textContent = 'Daily Sales Report — ' + formatDate(data.date);
                contentEl.innerHTML = renderDailySales(data);
                break;
            case 'monthly':
                titleEl.textContent = 'Monthly Report — ' + data.month;
                contentEl.innerHTML = renderMonthlyReport(data);
                break;
            case 'amount-receivable':
                titleEl.textContent = 'Amount Receivable — ' + formatDate(data.date);
                contentEl.innerHTML = renderAmountReceivable(data);
                break;
            case 'debtor-aging':
                titleEl.textContent = 'Debtor Aging — ' + formatDate(data.date);
                contentEl.innerHTML = renderDebtorAging(data);
                break;
            case 'creditor-schedule':
                titleEl.textContent = 'Creditor Payment Schedule — ' + formatDate(data.date);
                contentEl.innerHTML = renderCreditorSchedule(data);
                break;
            case 'account-ledger':
                titleEl.textContent = 'Account Ledger: ' + data.account.name;
                contentEl.innerHTML = renderAccountLedger(data);
                break;
            case 'balance-sheet':
                titleEl.textContent = 'Balance Sheet — ' + formatDate(data.date);
                contentEl.innerHTML = renderBalanceSheet(data);
                break;
        }
    }

    function renderDailySales(data) {
        var html = '';
        html += '<div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-surface-container-low border-b border-outline-variant/10">';
        html += '  <div class="flex flex-col gap-2">';
        html += '    <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Total Daily Revenue</p>';
        html += '    <h3 class="text-4xl font-black text-primary tracking-tighter">' + formatINR(data.summary.total) + '</h3>';
        html += '    <p class="text-xs font-bold text-primary/60">' + data.summary.count + ' Business Invoices Issued</p>';
        html += '  </div>';
        html += '  <div class="flex items-center justify-end">';
        html += '    <div class="bg-green-100 px-6 py-4 rounded-2xl flex flex-col gap-1 border border-green-200">';
        html += '      <p class="text-[10px] font-bold text-green-700 uppercase tracking-widest opacity-60">Liquidity Collected</p>';
        html += '      <p class="text-2xl font-black text-green-700">' + formatINR(data.summary.paid) + '</p>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';

        if (data.sales.length > 0) {
            html += renderTable(data.sales, [
                { label: 'Invoice No', key: 'invoice_no', render: function(row) { return '<span class="font-bold text-primary">' + row.invoice_no + '</span>'; } },
                { label: 'Customer Entity', key: 'customer_name', render: function(row) { return '<span class="font-medium text-primary">' + escapeHtml(row.customer_name || 'Walk-in') + '</span>'; } },
                { label: 'Gross Value', key: 'total', align: 'text-right', render: function(row) { return '<span class="font-bold text-primary">' + formatINR(row.total) + '</span>'; } },
                { label: 'Realized', key: 'amount_paid', align: 'text-right', render: function(row) { return '<span class="text-xs font-bold text-green-600">' + formatINR(row.amount_paid) + '</span>'; } },
                { label: 'Audit Status', key: 'status', align: 'text-center', render: function(row) { return getStatusBadge(row.status); } }
            ]);
        } else {
            html += '<div class="py-20 text-center text-on-surface-variant opacity-40 uppercase tracking-widest font-bold text-xs italic">No trade activity recorded for this period</div>';
        }
        return html;
    }

    function renderMonthlyReport(data) {
        var html = '';
        html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 bg-surface-container-low border-b border-outline-variant/10">';
        html += '  <div class="space-y-1"> <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Gross Revenue</p> <h3 class="text-2xl font-black text-primary">' + formatINR(data.sales.total) + '</h3> <p class="text-[10px] font-bold text-primary/40 uppercase">' + data.sales.count + ' Sales</p> </div>';
        html += '  <div class="space-y-1"> <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Cash Inflow</p> <h3 class="text-2xl font-black text-green-600">' + formatINR(data.sales.paid) + '</h3> </div>';
        html += '  <div class="space-y-1"> <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Receivables</p> <h3 class="text-2xl font-black text-error">' + formatINR(data.sales.outstanding) + '</h3> </div>';
        html += '</div>';

        if (data.daily_breakdown.length > 0) {
            html += '<div class="px-8 py-4 bg-surface-container-lowest border-b border-outline-variant/5 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Chronological Breakdown</div>';
            html += renderTable(data.daily_breakdown, [
                { label: 'Business Date', key: 'date', render: function(row) { return '<span class="font-bold">' + formatDate(row.date) + '</span>'; } },
                { label: 'Trans Count', key: 'count', align: 'text-center' },
                { label: 'Volume', key: 'total', align: 'text-right', render: function(row) { return '<span class="font-black text-primary">' + formatINR(row.total) + '</span>'; } }
            ]);
        }

        if (data.top_customers && data.top_customers.length > 0) {
            html += '<div class="px-8 py-4 bg-surface-container-lowest border-b border-outline-variant/5 text-[10px] font-black text-on-surface-variant uppercase tracking-widest mt-4">Key Client Relationships</div>';
            html += renderTable(data.top_customers, [
                { label: 'Client Name', key: 'name', render: function(row) { return '<span class="font-bold text-primary">' + escapeHtml(row.name) + '</span>'; } },
                { label: 'Trade Frequency', key: 'sale_count', align: 'text-center' },
                { label: 'Contribution', key: 'total', align: 'text-right', render: function(row) { return '<span class="font-black text-primary">' + formatINR(row.total) + '</span>'; } }
            ]);
        }
        return html;
    }

    function renderDebtorAging(data) {
        var html = '';
        html += '<div class="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-surface-container-low border-b border-outline-variant/10 text-center">';
        html += '  <div class="p-4 bg-white rounded-xl border border-outline-variant/10 shadow-sm"><p class="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">Current (0-30)</p><p class="text-xl font-black text-primary">' + formatINR(data.totals['0-30']) + '</p></div>';
        html += '  <div class="p-4 bg-white rounded-xl border border-outline-variant/10 shadow-sm"><p class="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Delinquent (30-60)</p><p class="text-xl font-black text-primary">' + formatINR(data.totals['30-60']) + '</p></div>';
        html += '  <div class="p-4 bg-white rounded-xl border border-outline-variant/10 shadow-sm"><p class="text-[9px] font-black text-error uppercase tracking-widest mb-1">Default (60+)</p><p class="text-xl font-black text-primary">' + formatINR(data.totals['60+']) + '</p></div>';
        html += '  <div class="p-4 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><p class="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Aggregate Debt</p><p class="text-xl font-black">' + formatINR(data.grand_total) + '</p></div>';
        html += '</div>';

        var allDebtors = data.buckets['0-30'].concat(data.buckets['30-60']).concat(data.buckets['60+']);
        if (allDebtors.length > 0) {
            html += renderTable(allDebtors, [
                { label: 'Strategic Partner', key: 'name', render: function(row) { return '<span class="font-bold text-primary">' + escapeHtml(row.name) + '</span>'; } },
                { label: 'Exposure Period', key: 'days_outstanding', render: function(row) {
                    var cls = row.days_outstanding > 60 ? 'bg-error/10 text-error' : (row.days_outstanding > 30 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700');
                    return '<span class="px-2 py-1 rounded-full text-[10px] font-black ' + cls + ' whitespace-nowrap">' + row.days_outstanding + ' DAYS AGED</span>';
                }},
                { label: 'Receivable Balance', key: 'current_balance', align: 'text-right', render: function(row) {
                    return '<span class="font-black text-error">' + formatBalance(row.current_balance, 'customer') + '</span>';
                }}
            ]);
        }
        return html;
    }

    function renderCreditorSchedule(data) {
        var html = '';
        html += '<div class="p-8 bg-surface-container-low border-b border-outline-variant/10">';
        html += '  <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60 mb-1">Aggregate Payables Liability</p>';
        html += '  <h3 class="text-4xl font-black text-primary tracking-tighter">' + formatINR(data.total) + '</h3>';
        html += '  <p class="text-xs font-bold text-error/60 mt-1">' + data.creditors.length + ' Vendor Obligations Outstanding</p>';
        html += '</div>';

        if (data.creditors.length > 0) {
            html += renderTable(data.creditors, [
                { label: 'Supplier Entity', key: 'name', render: function(row) { return '<span class="font-bold text-primary">' + escapeHtml(row.name) + '</span>'; } },
                { label: 'Last Settlement', key: 'last_payment_date', render: function(row) { return '<span class="text-xs font-medium text-on-surface-variant">' + formatDate(row.last_payment_date) + '</span>'; } },
                { label: 'Settlement Amount Due', key: 'current_balance', align: 'text-right', render: function(row) {
                    return '<span class="font-black text-error">' + formatBalance(row.current_balance, 'supplier') + '</span>';
                }}
            ]);
        } else {
            html += '<div class="py-20 text-center text-on-surface-variant opacity-40 uppercase tracking-widest font-bold text-xs italic text-green-600">All vendor obligations fulfilled</div>';
        }
        return html;
    }

    function renderBalanceSheet(data) {
        var html = '';
        var typeLabels = {
            customer: 'Trade Debtor Portfolios', supplier: 'Trade Creditor Obligations',
            cash: 'Liquid Capital Reserves', bank: 'Institutional Deposits',
            expense: 'Operating Expenditures', revenue: 'Gross Revenue Streams'
        };

        for (var type in data.accounts) {
            var accounts = data.accounts[type];
            var typeTotal = accounts.reduce((sum, a) => sum + a.current_balance, 0);

            html += '<div class="px-8 py-5 bg-surface-container-low border-b border-outline-variant/10 flex justify-between items-end">';
            html += '  <div><p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60 leading-none mb-1">Asset/Liability Category</p><h4 class="text-lg font-black text-primary tracking-tight">' + (typeLabels[type] || type) + '</h4></div>';
            html += '  <div class="text-right"><p class="text-[10px] font-black text-primary uppercase tracking-widest opacity-60 leading-none mb-1">Subtotal Exposure</p><p class="text-xl font-black text-primary">' + formatBalance(typeTotal, type) + '</p></div>';
            html += '</div>';

            html += renderTable(accounts, [
                { label: 'Internal Account ID', key: 'name', render: function(row) { return '<span class="font-bold text-primary">' + escapeHtml(row.name) + '</span>'; } },
                { label: 'Book Value', key: 'current_balance', align: 'text-right', render: function(row) {
                    return '<span class="font-black ' + (row.current_balance < 0 ? 'text-error' : 'text-primary') + '">' + formatBalance(row.current_balance, type) + '</span>';
                }}
            ]);
        }
        return html;
    }

    function renderAccountLedger(data) {
        var html = '';
        var totalCredits = (data.transactions || []).filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
        var totalDebits = (data.transactions || []).filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);

        html += '<div class="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-surface-container-low border-b border-outline-variant/10 text-center">';
        html += '  <div class="p-4 bg-white rounded-xl border border-outline-variant/10 shadow-sm"><p class="text-[9px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Opening Balance</p><p class="text-xl font-black text-primary">' + formatBalance(data.opening_balance, data.account.type) + '</p></div>';
        html += '  <div class="p-4 bg-white rounded-xl border border-outline-variant/10 shadow-sm"><p class="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">Aggregate Credits</p><p class="text-xl font-black text-green-600">' + formatINR(totalCredits) + '</p></div>';
        html += '  <div class="p-4 bg-white rounded-xl border border-outline-variant/10 shadow-sm"><p class="text-[9px] font-black text-error uppercase tracking-widest mb-1">Aggregate Debits</p><p class="text-xl font-black text-error">' + formatINR(totalDebits) + '</p></div>';
        html += '  <div class="p-4 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><p class="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Final Book Value</p><p class="text-xl font-black">' + formatBalance(data.closing_balance, data.account.type) + '</p></div>';
        html += '</div>';

        if (data.transactions.length > 0) {
            html += renderTable(data.transactions, [
                { label: 'Audit Date', key: 'date', render: function(row) { return '<span class="text-xs font-bold text-primary">' + formatDate(row.date) + '</span>'; } },
                { label: 'Particulars & Descriptions', key: 'description', render: function(row) { 
                    var desc = '<div class="flex flex-col gap-1">';
                    desc += '<span class="text-sm font-bold text-primary leading-tight">' + escapeHtml(row.description || 'General Entry') + '</span>';
                    desc += '<div class="flex gap-2 items-center">';
                    if (row.ref_no) desc += '<span class="text-[9px] font-black bg-surface-container-highest px-2 py-0.5 rounded text-on-surface-variant uppercase tracking-tighter">REF: ' + row.ref_no + '</span>';
                    if (row.linked_invoice) desc += '<span class="text-[9px] font-black bg-primary/5 px-2 py-0.5 rounded text-primary uppercase tracking-tighter">INV: ' + row.linked_invoice + '</span>';
                    if (row.payment_mode) desc += '<span class="text-[9px] font-black bg-secondary-container/30 px-2 py-0.5 rounded text-secondary uppercase tracking-tighter">' + row.payment_mode + '</span>';
                    desc += '</div></div>';

                    var images = [];
                    try { if (row.sale_images && row.sale_images !== '[]') images = JSON.parse(row.sale_images); } catch(e){}
                    try { if (row.purchase_images && row.purchase_images !== '[]') images = images.concat(JSON.parse(row.purchase_images)); } catch(e){}
                    
                    if (images && images.length > 0) {
                        var encodedUrls = encodeURIComponent(JSON.stringify(images));
                        desc += '<button class="mt-2 flex items-center gap-1.5 px-3 py-1 bg-surface-container-high rounded-full text-[9px] font-black text-primary uppercase border border-outline-variant/20 hover:bg-white transition-all shadow-sm" onclick="openGalleryModal(\'' + encodedUrls + '\')"><span class="material-symbols-outlined text-sm">visibility</span> Evidence Attached (' + images.length + ')</button>';
                    }
                    return desc;
                }},
                { label: 'Audit Flows', key: 'amount', align: 'text-right', render: function(row) { 
                    var flow = row.type === 'debit' ? '<div class="text-right"><span class="text-[8px] font-black text-error uppercase opacity-60">DEBIT OUT</span><p class="font-black text-error text-sm">' + formatINR(row.amount) + '</p></div>' : 
                                                      '<div class="text-right"><span class="text-[8px] font-black text-green-600 uppercase opacity-60">CREDIT IN</span><p class="font-black text-green-600 text-sm">' + formatINR(row.amount) + '</p></div>';
                    return flow;
                }},
                { label: 'Running Balance', key: 'running_balance', align: 'text-right', render: function(row) { 
                    return '<div class="text-right"><span class="text-[8px] font-black text-on-surface-variant uppercase opacity-40">LEDGER POS</span><p class="font-bold text-primary text-xs">' + formatBalance(row.running_balance, data.account.type) + '</p></div>'; 
                }}
            ]);
        } else {
            html += '<div class="py-20 text-center text-on-surface-variant opacity-40 uppercase tracking-widest font-bold text-xs italic">Zero transaction volume for selected audit window</div>';
        }
        return html;
    }

    function renderAmountReceivable(data) {
        var html = '';
        html += '<div class="p-8 bg-surface-container-low border-b border-outline-variant/10">';
        html += '  <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60 mb-1">Consolidated Receivables Assets</p>';
        html += '  <h3 class="text-4xl font-black text-primary tracking-tighter">' + formatINR(data.total) + '</h3>';
        html += '  <p class="text-xs font-bold text-green-600/60 mt-1">' + data.customers.length + ' Active Client Exposures</p>';
        html += '</div>';

        if (data.customers.length > 0) {
            html += renderTable(data.customers, [
                { label: 'Debtor Entity Name', key: 'name', render: function(row) { return '<span class="font-bold text-primary">' + escapeHtml(row.name) + '</span>'; } },
                { label: 'Primary Contact', key: 'phone', render: function(row) { return '<span class="text-xs font-medium text-on-surface-variant opacity-60">' + (row.phone || '—') + '</span>'; } },
                { label: 'Strategic Receivables Balance', key: 'current_balance', align: 'text-right', render: function(row) {
                    return '<span class="font-black text-error">' + formatBalance(row.current_balance, 'customer') + '</span>';
                }}
            ]);
        } else {
            html += '<div class="py-20 text-center text-on-surface-variant opacity-40 uppercase tracking-widest font-bold text-xs italic text-green-600">Zero default risk: All receivables collected</div>';
        }
        return html;
    }

    // Handle URL parameters
    var urlParams = new URLSearchParams(window.location.search);
    var typeParam = urlParams.get('type');
    if (typeParam) {
        setTimeout(function() {
            switchReport(typeParam);
        }, 100);
    } else {
        switchReport('daily-sales');
    }
    
})();
