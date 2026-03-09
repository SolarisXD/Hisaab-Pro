/**
 * reports.js — Hisaab Pro Reports Page Controller
 */

'use strict';

(function() {
    checkAuth().then(function(user) {
        if (!user) return;
        loadCommonUI();
    });

    var reportType = document.getElementById('report-type');
    var reportDate = document.getElementById('report-date');
    var reportMonth = document.getElementById('report-month');
    var reportAccount = document.getElementById('report-account');
    var reportDateFrom = document.getElementById('report-date-from');
    var reportDateTo = document.getElementById('report-date-to');
    var rangeFilters = document.getElementById('range-filters');
    var btnExportOptions = document.getElementById('btn-export-options');
    var exportModal = document.getElementById('export-modal');
    var btnGenerate = document.getElementById('btn-generate');
    var currentReportData = null;
    var currentReportType = '';

    // Set defaults
    reportDate.value = getToday();
    reportMonth.value = getCurrentMonth();
    reportDateFrom.value = getToday();
    reportDateTo.value = getToday();

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
    reportType.addEventListener('change', function() {
        reportDate.style.display = 'none';
        reportMonth.style.display = 'none';
        reportAccount.style.display = 'none';
        rangeFilters.style.display = 'none';

        if (this.value === 'monthly') {
            reportMonth.style.display = 'block';
        } else if (this.value === 'daily-sales') {
            reportDate.style.display = 'block';
        } else if (this.value === 'account-ledger') {
            reportAccount.style.display = 'block';
            rangeFilters.style.display = 'flex';
        }
    });

    btnGenerate.addEventListener('click', generateReport);
    
    if (btnExportOptions) {
        btnExportOptions.addEventListener('click', function() {
            exportModal.classList.add('active');
        });
    }

    window.closeExportModal = function() {
        exportModal.classList.remove('active');
    };

    document.getElementById('btn-export-pdf').addEventListener('click', function() {
        var title = document.getElementById('report-title').textContent || 'Report';
        pdf.generateReportPDF(document.getElementById('report-content'), title, title.replace(/[^a-z0-9]/gi, '_') + '.pdf');
        closeExportModal();
    });

    document.getElementById('btn-export-excel').addEventListener('click', function() {
        if (!currentReportData) return;
        var title = document.getElementById('report-title').textContent || 'Report';
        var filename = title.replace(/[^a-z0-9]/gi, '_') + '.csv';
        
        // Flatten data for CSV if needed
        var exportData = [];
        if (currentReportType === 'daily-sales') exportData = currentReportData.sales;
        else if (currentReportType === 'account-ledger') exportData = currentReportData.transactions;
        else if (currentReportType === 'debtor-aging') exportData = currentReportData.buckets['0-30'].concat(currentReportData.buckets['30-60']).concat(currentReportData.buckets['60+']);
        else if (currentReportType === 'creditor-schedule') exportData = currentReportData.creditors;
        else {
            showToast('Export for this report type is pending optimization', 'info');
            return;
        }

        downloadCSV(exportData, filename);
        closeExportModal();
    });

    function generateReport() {
        var type = reportType.value;
        var params = {};
        var endpoint = '/reports/' + type;

        if (type === 'daily-sales') {
            params.date = reportDate.value;
        } else if (type === 'monthly') {
            params.month = reportMonth.value;
        } else if (type === 'account-ledger') {
            params.account_id = reportAccount.value;
            params.date_from = reportDateFrom.value;
            params.date_to = reportDateTo.value;
            if (!params.account_id) {
                showToast('Please select an account', 'warning');
                return;
            }
        }

        btnGenerate.disabled = true;
        btnGenerate.textContent = 'Generating...';

        api.get(endpoint, params)
            .then(function(data) {
                currentReportData = data;
                currentReportType = type;
                renderReport(type, data);
                document.getElementById('report-panel').style.display = 'block';
                btnGenerate.disabled = false;
                btnGenerate.textContent = 'Generate Report';
                lucide.createIcons();
            })
            .catch(function(err) {
                var contentEl = document.getElementById('report-content');
                if (contentEl) contentEl.innerHTML = '<div class="error-state"><i data-lucide="alert-circle"></i><p>' + escapeHtml(err.message) + '</p></div>';
                showToast('Error generating report: ' + err.message, 'error');
                btnGenerate.disabled = false;
                btnGenerate.textContent = 'Generate Report';
                lucide.createIcons();
            });
    }

    function renderReport(type, data) {
        var titleEl = document.getElementById('report-title');
        var contentEl = document.getElementById('report-content');

        switch (type) {
            case 'daily-sales':
                titleEl.innerHTML = '<i data-lucide="calendar"></i> Daily Sales Report — ' + formatDate(data.date);
                contentEl.innerHTML = renderDailySales(data);
                break;
            case 'monthly':
                titleEl.innerHTML = '<i data-lucide="bar-chart-3"></i> Monthly Report — ' + data.month;
                contentEl.innerHTML = renderMonthlyReport(data);
                break;
            case 'debtor-aging':
                titleEl.innerHTML = '<i data-lucide="clock"></i> Debtor Aging Report — ' + formatDate(data.date);
                contentEl.innerHTML = renderDebtorAging(data);
                break;
            case 'creditor-schedule':
                titleEl.innerHTML = '<i data-lucide="clipboard-list"></i> Creditor Payment Schedule — ' + formatDate(data.date);
                contentEl.innerHTML = renderCreditorSchedule(data);
                break;
            case 'account-ledger':
                titleEl.innerHTML = '<i data-lucide="book-open"></i> Account Ledger: ' + data.account.name;
                contentEl.innerHTML = renderAccountLedger(data);
                break;
            case 'balance-sheet':
                titleEl.innerHTML = '<i data-lucide="file-text"></i> Balance Sheet — ' + formatDate(data.date);
                contentEl.innerHTML = renderBalanceSheet(data);
                break;
        }
    }

    function renderDailySales(data) {
        var html = '';
        // Summary
        html += '<div class="stats-row" style="margin-bottom:20px;">';
        html += '<div class="stat-card primary"><div class="stat-label">Total Sales</div><div class="stat-value">' + formatINR(data.summary.total) + '</div><div class="stat-change">' + data.summary.count + ' invoices</div></div>';
        html += '<div class="stat-card success"><div class="stat-label">Amount Received</div><div class="stat-value">' + formatINR(data.summary.paid) + '</div></div>';
        html += '</div>';

        // Sales table
        if (data.sales.length > 0) {
            html += renderTable(data.sales, [
                { label: 'Invoice', key: 'invoice_no' },
                { label: 'Customer', key: 'customer_name', render: function(row) { return escapeHtml(row.customer_name || 'Walk-in'); } },
                { label: 'Total', key: 'total', align: 'text-right', render: function(row) { return '<span class="amount">' + formatINR(row.total) + '</span>'; } },
                { label: 'Paid', key: 'amount_paid', align: 'text-right', render: function(row) { return formatINR(row.amount_paid); } },
                { label: 'Status', key: 'status', render: function(row) { return getStatusBadge(row.status); } }
            ]);
        } else {
            html += '<div class="empty-state"><div class="empty-icon"><i data-lucide="clipboard-list"></i></div><p>No sales on this date</p></div>';
        }
        return html;
    }

    function renderMonthlyReport(data) {
        var html = '';
        html += '<div class="stats-row" style="margin-bottom:20px;">';
        html += '<div class="stat-card primary"><div class="stat-label">Total Revenue</div><div class="stat-value">' + formatINR(data.sales.total) + '</div><div class="stat-change">' + data.sales.count + ' sales</div></div>';
        html += '<div class="stat-card success"><div class="stat-label">Collected</div><div class="stat-value">' + formatINR(data.sales.paid) + '</div></div>';
        html += '<div class="stat-card danger"><div class="stat-label">Outstanding</div><div class="stat-value">' + formatINR(data.sales.outstanding) + '</div></div>';
        html += '</div>';

        // Daily breakdown
        if (data.daily_breakdown.length > 0) {
            html += '<h4 style="margin-bottom:12px;">Daily Breakdown</h4>';
            html += renderTable(data.daily_breakdown, [
                { label: 'Date', key: 'date', render: function(row) { return formatDate(row.date); } },
                { label: 'Sales', key: 'count' },
                { label: 'Total', key: 'total', align: 'text-right', render: function(row) { return '<span class="amount">' + formatINR(row.total) + '</span>'; } }
            ]);
        }

        // Top customers
        if (data.top_customers && data.top_customers.length > 0) {
            html += '<h4 style="margin: 20px 0 12px;">Top Customers</h4>';
            html += renderTable(data.top_customers, [
                { label: 'Customer', key: 'name' },
                { label: 'Sales', key: 'sale_count' },
                { label: 'Total', key: 'total', align: 'text-right', render: function(row) { return '<span class="amount">' + formatINR(row.total) + '</span>'; } }
            ]);
        }
        return html;
    }

    function renderDebtorAging(data) {
        var html = '';
        html += '<div class="stats-row" style="margin-bottom:20px;">';
        html += '<div class="stat-card success"><div class="stat-label">0–30 Days</div><div class="stat-value">' + formatINR(data.totals['0-30']) + '</div><div class="stat-change">' + data.buckets['0-30'].length + ' customers</div></div>';
        html += '<div class="stat-card warning"><div class="stat-label">30–60 Days</div><div class="stat-value">' + formatINR(data.totals['30-60']) + '</div><div class="stat-change">' + data.buckets['30-60'].length + ' customers</div></div>';
        html += '<div class="stat-card danger"><div class="stat-label">60+ Days</div><div class="stat-value">' + formatINR(data.totals['60+']) + '</div><div class="stat-change">' + data.buckets['60+'].length + ' customers</div></div>';
        html += '</div>';
        html += '<div class="stat-card" style="margin-bottom:20px;"><div class="stat-label">Grand Total Outstanding</div><div class="stat-value" style="color:var(--color-danger);">' + formatINR(data.grand_total) + '</div></div>';

        // List all debtors
        var allDebtors = data.buckets['0-30'].concat(data.buckets['30-60']).concat(data.buckets['60+']);
        if (allDebtors.length > 0) {
            html += renderTable(allDebtors, [
                { label: 'Customer', key: 'name', render: function(row) { return '<span style="font-weight:600;">' + escapeHtml(row.name) + '</span>'; } },
                { label: 'Phone', key: 'phone', render: function(row) { return escapeHtml(row.phone || '—'); } },
                { label: 'Days', key: 'days_outstanding', render: function(row) {
                    var cls = row.days_outstanding > 60 ? 'badge-danger' : (row.days_outstanding > 30 ? 'badge-warning' : 'badge-success');
                    return '<span class="badge ' + cls + '">' + row.days_outstanding + ' days</span>';
                }},
                { label: 'Outstanding', key: 'current_balance', align: 'text-right', render: function(row) {
                    return '<span class="amount negative">' + formatINR(row.current_balance) + '</span>';
                }}
            ]);
        }
        return html;
    }

    function renderCreditorSchedule(data) {
        var html = '';
        html += '<div class="stat-card danger" style="margin-bottom:20px;"><div class="stat-label">Total Payable</div><div class="stat-value">' + formatINR(data.total) + '</div><div class="stat-change">' + data.creditors.length + ' suppliers</div></div>';

        if (data.creditors.length > 0) {
            html += renderTable(data.creditors, [
                { label: 'Supplier', key: 'name', render: function(row) { return '<span style="font-weight:600;">' + escapeHtml(row.name) + '</span>'; } },
                { label: 'Phone', key: 'phone', render: function(row) { return escapeHtml(row.phone || '—'); } },
                { label: 'Last Payment', key: 'last_payment_date', render: function(row) { return formatDate(row.last_payment_date); } },
                { label: 'Amount Due', key: 'current_balance', align: 'text-right', render: function(row) {
                    return '<span class="amount negative">' + formatINR(row.current_balance) + '</span>';
                }}
            ]);
        } else {
            html += '<div class="empty-state"><p>No outstanding amounts</p></div>';
        }
        return html;
    }

    function renderBalanceSheet(data) {
        var html = '';
        var typeLabels = {
            customer: '👤 Customers (Debtors)', supplier: '🏭 Suppliers (Creditors)',
            cash: '💵 Cash Accounts', bank: '🏦 Bank Accounts',
            expense: '📤 Expense Accounts', revenue: '📥 Revenue Accounts'
        };

        for (var type in data.accounts) {
            var accounts = data.accounts[type];
            var typeTotal = 0;
            for (var i = 0; i < accounts.length; i++) typeTotal += accounts[i].current_balance;

            html += '<h4 style="margin:20px 0 12px;">' + (typeLabels[type] || type) + ' — Total: <span class="amount">' + formatINR(typeTotal) + '</span></h4>';
            html += renderTable(accounts, [
                { label: 'Account', key: 'name', render: function(row) { return escapeHtml(row.name); } },
                { label: 'Balance', key: 'current_balance', align: 'text-right', render: function(row) {
                    return '<span class="amount">' + formatINR(row.current_balance) + '</span>';
                }}
            ]);
        }
        return html;
    }

    function renderAccountLedger(data) {
        var html = '';
        
        // Calculate totals manually for compatibility
        var totalCredits = 0;
        var totalDebits = 0;
        if (data.transactions) {
            for (var i = 0; i < data.transactions.length; i++) {
                var t = data.transactions[i];
                if (t.type === 'credit') totalCredits += t.amount;
                else if (t.type === 'debit') totalDebits += t.amount;
            }
        }

        html += '<div class="stats-row" style="margin-bottom:20px;">';
        html += '<div class="stat-card primary"><div class="stat-label">Opening Balance</div><div class="stat-value">' + formatINR(data.opening_balance) + '</div></div>';
        html += '<div class="stat-card success"><div class="stat-label">Total Credits</div><div class="stat-value">' + formatINR(totalCredits) + '</div></div>';
        html += '<div class="stat-card danger"><div class="stat-label">Total Debits</div><div class="stat-value">' + formatINR(totalDebits) + '</div></div>';
        html += '</div>';
        html += '<div class="stat-card" style="margin-bottom:20px;"><div class="stat-label">Closing Balance</div><div class="stat-value" style="color:var(--color-primary);">' + formatINR(data.closing_balance) + '</div></div>';

        if (data.transactions.length > 0) {
            html += renderTable(data.transactions, [
                { label: 'Date', key: 'date', render: function(row) { return formatDate(row.date); } },
                { label: 'Description', key: 'description', render: function(row) { 
                    var desc = escapeHtml(row.description || 'Entry');
                    if (row.linked_invoice) desc += ' (Inv: ' + row.linked_invoice + ')';
                    if (row.payment_mode) desc += ' [' + row.payment_mode + ']';
                    return desc;
                }},
                { label: 'Debit', key: 'amount', align: 'text-right', render: function(row) { 
                    return row.type === 'debit' ? '<span class="amount negative">' + formatINR(row.amount) + '</span>' : '—'; 
                }},
                { label: 'Credit', key: 'amount', align: 'text-right', render: function(row) { 
                    return row.type === 'credit' ? '<span class="amount positive">' + formatINR(row.amount) + '</span>' : '—'; 
                }},
                { label: 'Balance', key: 'running_balance', align: 'text-right', render: function(row) { 
                    return '<strong>' + formatINR(row.running_balance) + '</strong>'; 
                }}
            ]);
        } else {
            html += '<div class="empty-state"><p>No transactions found for this period</p></div>';
        }
        return html;
    }
})();
