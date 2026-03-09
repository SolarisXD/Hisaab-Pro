/**
 * dashboard.js — Hisaab Pro Dashboard Controller
 * 
 * Loads dashboard data and renders stats, charts, and recent transactions.
 */

'use strict';

(function() {
    // Check authentication
    checkAuth().then(function(user) {
        if (!user) return;

        // Set user info
        document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();
        document.getElementById('username-display').textContent = user.username;

        // Load shared UI elements
        loadCommonUI();

        // Load dashboard data
        loadDashboard();
    });


    // User menu dropdown
    var menuToggle = document.getElementById('user-menu-toggle');
    var dropdown = document.getElementById('user-dropdown');
    if (menuToggle && dropdown) {
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });
        document.addEventListener('click', function() {
            dropdown.classList.remove('active');
        });
    }

    function loadDashboard() {
        api.get('/dashboard')
            .then(function(data) {
                // Stats cards
                document.getElementById('today-sales').textContent = formatINR(data.today_sales.total);
                document.getElementById('today-sales-count').textContent = data.today_sales.count + ' invoice' + (data.today_sales.count !== 1 ? 's' : '');

                document.getElementById('month-sales').textContent = formatINR(data.month_sales.total);
                document.getElementById('month-sales-count').textContent = data.month_sales.count + ' invoice' + (data.month_sales.count !== 1 ? 's' : '');

                document.getElementById('total-debtors').textContent = formatINR(data.total_debtors);
                document.getElementById('total-creditors').textContent = formatINR(data.total_creditors);

                document.getElementById('cash-balance').textContent = formatINR(data.cash_balance);
                document.getElementById('bank-balance').textContent = formatINR(data.bank_balance);

                // Recent transactions
                renderRecentTransactions(data.recent_transactions);

                // Charts (simple text-based if Chart.js not loaded)
                if (typeof Chart !== 'undefined') {
                    renderDailyChart(data.charts.daily_trend);
                    renderMonthlyChart(data.charts.monthly_comparison);
                } else {
                    renderSimpleCharts(data.charts);
                }
            })
            .catch(function(err) {
                showToast('Failed to load dashboard: ' + err.message, 'error');
            });
    }

    function renderRecentTransactions(transactions) {
        var container = document.getElementById('recent-transactions');

        if (!transactions || transactions.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No recent transactions</p></div>';
            return;
        }

        var html = renderTable(transactions, [
            { label: 'Date', key: 'date', render: function(row) { return formatDate(row.date); } },
            { label: 'Account', key: 'account_name', render: function(row) { return escapeHtml(row.account_name || '—'); } },
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

        container.innerHTML = html;
    }

    function renderSimpleCharts(charts) {
        // Fallback text-based display if Chart.js not loaded
        var dailyEl = document.getElementById('daily-chart');
        var monthlyEl = document.getElementById('monthly-chart');

        if (charts.daily_trend && charts.daily_trend.length > 0) {
            var dailyHtml = '<div style="padding: 16px;">';
            for (var i = 0; i < charts.daily_trend.length; i++) {
                var d = charts.daily_trend[i];
                var maxVal = Math.max.apply(null, charts.daily_trend.map(function(x) { return x.total; })) || 1;
                var width = Math.max(5, (d.total / maxVal) * 100);
                dailyHtml += '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">';
                dailyHtml += '<span style="width: 80px; font-size: 12px; color: var(--color-text-secondary);">' + formatDate(d.date) + '</span>';
                dailyHtml += '<div style="flex: 1; background: var(--color-bg); border-radius: 4px; height: 24px;">';
                dailyHtml += '<div style="width: ' + width + '%; background: var(--color-primary); border-radius: 4px; height: 100%; display: flex; align-items: center; padding-left: 8px;">';
                dailyHtml += '<span style="font-size: 11px; color: white; font-weight: 600;">' + formatINR(d.total) + '</span>';
                dailyHtml += '</div></div>';
                dailyHtml += '</div>';
            }
            dailyHtml += '</div>';
            dailyEl.parentNode.innerHTML = dailyHtml;
        } else {
            dailyEl.parentNode.innerHTML = '<div class="empty-state"><p>No sales data yet</p></div>';
        }

        if (charts.monthly_comparison && charts.monthly_comparison.length > 0) {
            var monthlyHtml = '<div style="padding: 16px;">';
            for (var m = 0; m < charts.monthly_comparison.length; m++) {
                var mm = charts.monthly_comparison[m];
                var maxMonthVal = Math.max.apply(null, charts.monthly_comparison.map(function(x) { return x.total; })) || 1;
                var mWidth = Math.max(5, (mm.total / maxMonthVal) * 100);
                monthlyHtml += '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">';
                monthlyHtml += '<span style="width: 80px; font-size: 12px; color: var(--color-text-secondary);">' + mm.month + '</span>';
                monthlyHtml += '<div style="flex: 1; background: var(--color-bg); border-radius: 4px; height: 24px;">';
                monthlyHtml += '<div style="width: ' + mWidth + '%; background: var(--color-accent); border-radius: 4px; height: 100%; display: flex; align-items: center; padding-left: 8px;">';
                monthlyHtml += '<span style="font-size: 11px; color: white; font-weight: 600;">' + formatINR(mm.total) + '</span>';
                monthlyHtml += '</div></div>';
                monthlyHtml += '</div>';
            }
            monthlyHtml += '</div>';
            monthlyEl.parentNode.innerHTML = monthlyHtml;
        } else {
            monthlyEl.parentNode.innerHTML = '<div class="empty-state"><p>No monthly data yet</p></div>';
        }
    }

    function renderDailyChart(data) {
        var ctx = document.getElementById('daily-chart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(function(d) { return formatDate(d.date); }),
                datasets: [{
                    label: 'Sales',
                    data: data.map(function(d) { return d.total; }),
                    backgroundColor: 'rgba(37, 99, 235, 0.7)',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    function renderMonthlyChart(data) {
        var ctx = document.getElementById('monthly-chart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(function(d) { return d.month; }),
                datasets: [{
                    label: 'Revenue',
                    data: data.map(function(d) { return d.total; }),
                    backgroundColor: 'rgba(22, 163, 74, 0.7)',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
})();
