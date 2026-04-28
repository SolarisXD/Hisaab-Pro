'use strict';

var { db } = require('../../db/database');
var accountsService = require('../accounts/accounts.service');
var logger = require('../../shared/logger');

function listStaff(isDecoy) {
    return db.prepare(`
        SELECT a.id, a.name, a.type, a.phone, a.current_balance, s.monthly_salary, s.daily_wage 
        FROM accounts a
        JOIN staff_details s ON a.id = s.account_id
        WHERE a.type = 'staff' AND a.is_active = 1 AND a.is_deleted = 0 AND a.is_decoy = ?
    `).all(isDecoy ? 1 : 0);
}

function createStaff(data, isDecoy) {
    var monthly = parseFloat(data.monthly_salary) || 0;
    var daily = monthly / 30; // standard simplistic calculation used commonly

    var transaction = db.transaction(() => {
        // 1. Create the account using existing service
        var newAccount = accountsService.createAccount({
            name: data.name,
            type: 'staff',
            account_group: 'Staff',
            phone: data.phone,
            opening_balance: data.opening_balance || 0
        }, isDecoy);

        // 2. Add to staff_details
        db.prepare('INSERT INTO staff_details (account_id, monthly_salary, daily_wage) VALUES (?, ?, ?)')
          .run(newAccount.id, monthly, daily);
          
        return newAccount;
    });

    return transaction();
}

function getAttendance(accountId, year, month, isDecoy) {
    // Basic validation to ensure account is for current view context
    var acc = db.prepare("SELECT id FROM accounts WHERE id = ? AND is_decoy = ?").get(accountId, isDecoy ? 1 : 0);
    if (!acc) throw new Error("Staff account not found");

    var monthStr = month.toString().padStart(2, '0');
    var pattern = `${year}-${monthStr}-%`;
    
    return db.prepare(`
        SELECT id, date, status, notes 
        FROM staff_attendance 
        WHERE account_id = ? AND date LIKE ?
    `).all(accountId, pattern);
}

function markAttendance(accountId, date, status, notes, isDecoy) {
    // Valid status: present, half_day, absent, leave
    if (!['present', 'half_day', 'absent', 'leave'].includes(status)) throw new Error("Invalid status");
    
    var acc = db.prepare("SELECT id FROM accounts WHERE id = ? AND is_decoy = ?").get(accountId, isDecoy ? 1 : 0);
    if (!acc) throw new Error("Staff account not found");

    db.prepare(`
        INSERT INTO staff_attendance (account_id, date, status, notes) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(account_id, date) DO UPDATE SET status = excluded.status, notes = excluded.notes
    `).run(accountId, date, status, notes || null);
    
    return { success: true };
}

function generatePayroll(accountId, year, month, isDecoy) {
    // 1. Prevent duplicate payroll generation for the same month
    var monthStr = month.toString().padStart(2, '0');
    var existingPayroll = db.prepare(
        "SELECT id FROM transactions WHERE account_id = ? AND description LIKE ? AND is_decoy = ? AND is_deleted = 0"
    ).get(accountId, `Payroll for ${year}-${monthStr}%`, isDecoy ? 1 : 0);

    if (existingPayroll) {
        throw new Error(`Payroll for ${year}-${monthStr} has already been generated. Duplicate generations are not allowed.`);
    }

    var acc = db.prepare(`
        SELECT a.id, a.name, s.monthly_salary, s.daily_wage 
        FROM accounts a
        JOIN staff_details s ON a.id = s.account_id
        WHERE a.id = ? AND a.is_decoy = ?
    `).get(accountId, isDecoy ? 1 : 0);
    
    if (!acc) throw new Error("Staff account not found");

    var attendance = getAttendance(accountId, year, month, isDecoy);
    
    var daysAttended = 0;
    
    // Calculate payable days based strictly on logged attendance
    attendance.forEach(d => {
        if (d.status === 'present' || d.status === 'leave') daysAttended += 1;
        else if (d.status === 'half_day') daysAttended += 0.5;
    });

    var payableAmount = daysAttended * acc.daily_wage;

    if (payableAmount <= 0) {
        throw new Error("Cannot generate payroll: Staff member has 0 payable days logged this month. Please mark attendance first.");
    }

    var transaction = db.transaction(() => {
        // Record salary expense! (Credit to staff -> negative balance)
        db.prepare("UPDATE accounts SET current_balance = current_balance - ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(payableAmount, accountId);
        
        var dateStr = new Date().toISOString().split('T')[0]; // or end of month date
        var desc = `Payroll for ${year}-${month.toString().padStart(2, '0')} (${daysAttended} days)`;
        
        // 2. Add transaction noting this
        var res = db.prepare(
            'INSERT INTO transactions (date, account_id, type, amount, description, is_decoy, is_deleted) VALUES (?, ?, ?, ?, ?, ?, 0)'
        ).run(dateStr, accountId, 'credit', payableAmount, desc, isDecoy ? 1 : 0);

        // 3. Automatically create an outward payment (Cash out to staff)
        var paymentsService = require('../payments/payments.service');
        paymentsService.createPayment({
            date: dateStr,
            account_id: accountId,
            amount: payableAmount,
            type: 'out',
            mode: 'cash',
            notes: 'Automated Salary Dispersement: ' + desc
        }, isDecoy);

        return res.lastInsertRowid;
    });

    return transaction();
}

function updateStaff(accountId, data, isDecoy) {
    var transaction = db.transaction(() => {
        accountsService.updateAccount(accountId, {
            name: data.name,
            phone: data.phone
        }, isDecoy);
        
        var monthly = parseFloat(data.monthly_salary) || 0;
        var daily = monthly / 30;
        db.prepare('UPDATE staff_details SET monthly_salary = ?, daily_wage = ? WHERE account_id = ?').run(monthly, daily, accountId);
        
        return { success: true };
    });
    return transaction();
}

function deleteStaff(accountId, isDecoy) {
    accountsService.deleteAccount(accountId, isDecoy);
    return { success: true };
}

module.exports = {
    listStaff,
    createStaff,
    getAttendance,
    markAttendance,
    generatePayroll,
    updateStaff,
    deleteStaff
};
