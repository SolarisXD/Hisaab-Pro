/**
 * staff.js — Hisaab Pro Staff Page Controller
 */
'use strict';

(function() {
    var editingStaffId = null;
    var allStaff = [];

    checkAuth().then(function(user) {
        if (!user) return;
        loadCommonUI();
        loadStaffList();
    });

    document.getElementById('btn-new-staff').addEventListener('click', function() { window.openStaffModal(); });
    document.getElementById('btn-save-staff').addEventListener('click', saveStaff);
    
    document.getElementById('att-form').addEventListener('submit', function(e) {
        e.preventDefault();
        submitAttendance();
    });

    document.getElementById('btn-generate-payroll').addEventListener('click', generatePayroll);

    function loadStaffList() {
        var container = document.getElementById('staff-list');
        container.innerHTML = '<div class="loading-overlay"><div class="spinner lg"></div></div>';
        
        api.get('/staff').then(function(data) {
            allStaff = data;
            if (data.length === 0) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-40 text-on-surface-variant">
                        <span class="material-symbols-outlined text-6xl opacity-20 mb-4">group</span>
                        <h3 class="text-lg font-bold">No staff found</h3>
                        <p class="text-sm opacity-60">Add staff members to manage their attendance and payroll.</p>
                        <button class="mt-6 px-6 py-2.5 bg-primary text-white font-bold rounded-xl shadow-lg" onclick="openStaffModal()">+ Add Staff</button>
                    </div>`;
                return;
            }
            renderStaff(data);
            updateSidebarActiveState();
        }).catch(function(err) {
            container.innerHTML = `<div class="p-8 text-error font-medium">Error loading staff: ${err.message}</div>`;
        });
    }

    function updateSidebarActiveState() {
        var links = document.querySelectorAll('#sidebar [data-page]');
        links.forEach(function(link) {
            if (link.getAttribute('data-page') === 'staff') {
                link.classList.add('sidebar-active');
                link.classList.remove('text-slate-600', 'hover:bg-[#e4e2e1]/50');
                var icon = link.querySelector('.material-symbols-outlined');
                if (icon) icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                link.classList.remove('sidebar-active', 'font-bold');
            }
        });
    }

    // Sidebar toggle is handled in utils.js


    function renderStaff(staff) {
        var container = document.getElementById('staff-list');
        
        var html = renderTable(staff, [
            { label: 'Staff Member', key: 'name', render: function(row) {
                var initials = row.name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().substring(0, 2);
                var colors = ['bg-primary/10 text-primary', 'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-green-100 text-green-700'];
                var colorCls = colors[row.id % colors.length];
                return '<div class="flex items-center gap-4">' +
                            '<div class="w-10 h-10 rounded-lg ' + colorCls + ' flex items-center justify-center font-bold text-xs">' + initials + '</div>' +
                            '<div>' +
                                '<p class="text-sm font-bold text-primary">' + escapeHtml(row.name) + '</p>' +
                                '<p class="text-[10px] text-on-surface-variant uppercase tracking-tighter font-bold opacity-60">' + (row.phone || 'No Phone') + '</p>' +
                            '</div>' +
                       '</div>';
            }},
            { label: 'Monthly Salary', key: 'monthly_salary', align: 'text-right', render: function(row) {
                return '<span class="text-sm font-bold text-primary">' + formatINR(row.monthly_salary) + '</span>';
            }},
            { label: 'Status / Balance', key: 'account_balance', align: 'text-right', render: function(row) {
                var balanceStr = formatINR(Math.abs(row.account_balance)) + (row.account_balance > 0 ? ' Cr' : (row.account_balance < 0 ? ' Dr' : ''));
                var color = row.account_balance > 0 ? 'text-green-600' : (row.account_balance < 0 ? 'text-error' : 'text-on-surface-variant');
                return '<div class="text-right">' +
                            '<p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest leading-none mb-1 opacity-60">Balance</p>' +
                            '<p class="text-xs font-black ' + color + '">' + balanceStr + '</p>' +
                       '</div>';
            }},
            { label: 'Actions', key: 'id', align: 'text-right', render: function(row) {
                return '<div class="flex justify-end gap-2">' +
                            '<button class="p-2 text-primary hover:bg-primary/5 rounded-lg transition-colors" title="Edit Staff" onclick="event.stopPropagation(); editStaff(' + row.id + ')">' +
                                '<span class="material-symbols-outlined text-lg">edit</span>' +
                            '</button>' +
                            '<button class="px-4 py-1.5 text-[10px] font-bold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-all uppercase tracking-wider" onclick="event.stopPropagation(); openAttendanceModal(' + JSON.stringify(row).replace(/"/g, '&quot;') + ')">Payroll</button>' +
                       '</div>';
            }}
        ], { onRowClick: 'openAttendanceModalFromId' });
        
        container.innerHTML = html;
        
        // Update stats
        document.getElementById('stat-total-staff').textContent = staff.length;
        var totalPayroll = staff.reduce(function(sum, s) { return sum + (parseFloat(s.monthly_salary) || 0); }, 0);
        document.getElementById('stat-total-payroll').textContent = formatINR(totalPayroll);
        document.getElementById('stat-present-today').textContent = '— / ' + staff.length;
    }

    window.openAttendanceModalFromId = function(id) {
        var staff = allStaff.find(function(s) { return s.id === id; });
        if (staff) openAttendanceModal(staff);
    };

    window.openStaffModal = function() {
        document.getElementById('staff-form').reset();
        document.getElementById('staff-modal').classList.remove('hidden');
        setTimeout(function() {
            var modal = document.getElementById('staff-modal');
            modal.classList.remove('translate-y-full', 'opacity-0');
            modal.classList.add('active');
        }, 10);
    };

    window.closeStaffModal = function() {
        var modal = document.getElementById('staff-modal');
        modal.classList.remove('active');
        modal.classList.add('translate-y-full', 'opacity-0');
        setTimeout(function() { modal.classList.add('hidden'); }, 300);
        editingStaffId = null;
    };

    function saveStaff() {
        var btn = document.getElementById('btn-save-staff');
        var data = {
            name: document.getElementById('staff-name').value,
            phone: document.getElementById('staff-phone').value,
            monthly_salary: parseFloat(document.getElementById('staff-salary').value),
            opening_balance: parseFloat(document.getElementById('staff-opening-balance').value) || 0
        };

        if (!data.name || isNaN(data.monthly_salary)) {
            showToast('Please fill required fields (Name, Monthly Salary)', 'warning');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Saving...';

        api.post('/staff', data).then(function() {
            showToast('Staff added successfully!', 'success');
            closeStaffModal();
            loadStaffList();
        }).catch(function(err) {
            showToast(err.message, 'error');
        }).finally(function() {
            btn.disabled = false;
            btn.textContent = 'Save Staff';
        });
    }

    window.markAttendance = function(id) {
        var staff = allStaff.find(s => s.id === id);
        if (staff) {
            window.openAttendanceModal(staff.id, staff.name, staff.monthly_salary, staff.daily_wage || (staff.monthly_salary / 30), staff.account_balance);
        }
    };

    window.openAttendanceModal = function(id, name, salary, daily, balance) {
        editingStaffId = id;
        document.getElementById('att-staff-name').textContent = name;
        document.getElementById('att-monthly-salary').textContent = formatINR(salary).replace('₹', '');
        document.getElementById('att-daily-wage').textContent = formatINR(daily).replace('₹', '');
        document.getElementById('att-account-balance').textContent = formatINR(balance).replace('₹', '');
        
        var d = new Date();
        document.getElementById('att-month-picker').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        document.getElementById('form-att-date').value = d.toISOString().split('T')[0];
        
        var modal = document.getElementById('attendance-modal');
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('opacity-100'), 10);
        window.loadAttendance();
    };

    window.closeAttendanceModal = function() {
        var modal = document.getElementById('attendance-modal');
        modal.classList.remove('opacity-100');
        setTimeout(() => modal.classList.add('hidden'), 300);
        editingStaffId = null;
    };

    function renderAttendance(logs) {
        var container = document.getElementById('att-list');
        if (logs.length === 0) {
            container.innerHTML = '<div class="py-12 bg-surface-container-low/50 text-center"><p class="text-xs font-bold text-on-surface-variant opacity-40 uppercase tracking-widest">No records found</p></div>';
            return;
        }

        logs.sort((a,b) => b.date.localeCompare(a.date));

        container.innerHTML = renderTable(logs, [
            { label: 'Date', key: 'date', render: function(row) { return '<span class="text-xs font-bold text-primary">' + formatDate(row.date) + '</span>'; } },
            { label: 'Status', key: 'status', render: function(row) {
                var cls = 'bg-surface-container-high text-on-surface-variant';
                var text = row.status.toUpperCase();
                if (row.status === 'present') { cls = 'bg-green-100 text-green-700'; text = 'PRESENT'; }
                if (row.status === 'half_day') { cls = 'bg-amber-100 text-amber-700'; text = 'HALF DAY'; }
                if (row.status === 'absent') { cls = 'bg-error/10 text-error'; text = 'ABSENT'; }
                return '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold ' + cls + ' tracking-wider">' + text + '</span>';
            }},
            { label: 'Units', key: 'units', align: 'text-right', render: function(row) { return '<span class="font-bold text-primary">' + row.units + '</span>'; } }
        ]);
    }

    window.loadAttendance = function() {
        var picker = document.getElementById('att-month-picker').value;
        if (!picker || !editingStaffId) return;
        var parts = picker.split('-');
        var y = parts[0];
        var m = parts[1];

        var container = document.getElementById('att-list');
        container.innerHTML = '<div class="flex justify-center p-10"><div class="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div></div>';

        api.get(`/staff/${editingStaffId}/attendance?year=${y}&month=${m}`).then(function(data) {
            renderAttendance(data);
        }).catch(function(err) {
            container.innerHTML = `<div class="text-error p-4 text-xs font-bold">${err.message}</div>`;
        });
    };

    function submitAttendance() {
        var data = {
            date: document.getElementById('form-att-date').value,
            status: document.getElementById('form-att-status').value
        };
        api.post(`/staff/${editingStaffId}/attendance`, data).then(function() {
            showToast('Attendance marked!', 'success');
            window.loadAttendance();
        }).catch(function(err) {
            showToast('Error: ' + err.message, 'error');
        });
    }

    function generatePayroll() {
        var picker = document.getElementById('att-month-picker').value; // YYYY-MM
        if (!picker || !editingStaffId) return;
        var parts = picker.split('-');
        
        showConfirm({
            title: 'Generate Payroll',
            message: 'Are you sure you want to generate payroll for ' + picker + '? This will credit the staff account based on their attended days.',
            confirmText: 'Generate Payroll',
            intent: 'primary'
        }).then(function(confirmed) {
            if (!confirmed) return;
            var payload = { year: parseInt(parts[0]), month: parseInt(parts[1]) };
            api.post(`/staff/${editingStaffId}/payroll`, payload).then(function() {
                showToast('Payroll generated successfully!', 'success');
                loadStaffList();
                closeAttendanceModal();
            }).catch(function(err) {
                showToast(err.message, 'error');
            });
        });
    }

})();
