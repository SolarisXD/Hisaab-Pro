'use strict';

var express = require('express');
var router = express.Router();
var staffService = require('./staff.service');
var { requireAuth } = require('../auth/auth.middleware');
var { logActivity } = require('../auth/auth.service');
var { validate, staffSchema, attendanceSchema } = require('../../shared/validation');
var { isDateInActiveFY } = require('../../shared/utils');

router.use(requireAuth);

// Get all staff members
router.get('/', function(req, res) {
    try {
        var staffList = staffService.listStaff(req.session.user.is_decoy);
        res.json(staffList);
    } catch (err) {
        res.status(500).json({ error: 'Failed to list staff' });
    }
});

// Create a new staff member
router.post('/', validate(staffSchema), function(req, res) {
    try {
        var staff = staffService.createStaff(req.body, req.session.user.is_decoy);
        logActivity(req.session.user.id, 'create_staff', 'account', staff.id, null, req.ip);
        res.status(201).json(staff);
    } catch (err) {
        res.status(400).json({ error: err.message || 'Failed to create staff member' });
    }
});

// Get attendance for a specific month for a staff member
router.get('/:id/attendance', function(req, res) {
    try {
        var year = req.query.year || new Date().getFullYear();
        var month = req.query.month || (new Date().getMonth() + 1); // 1-12
        var attendance = staffService.getAttendance(parseInt(req.params.id), parseInt(year), parseInt(month), req.session.user.is_decoy);
        res.json(attendance);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve attendance' });
    }
});

// Mark attendance
router.post('/:id/attendance', validate(attendanceSchema), function(req, res) {
    try {
        var result = staffService.markAttendance(parseInt(req.params.id), req.body.date, req.body.status, req.body.notes, req.session.user.is_decoy);
        logActivity(req.session.user.id, 'mark_attendance', 'staff', parseInt(req.params.id), null, req.ip);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message || 'Failed to mark attendance' });
    }
});

// Generate Payroll
router.post('/:id/payroll', function(req, res) {
    try {
        var result = staffService.generatePayroll(parseInt(req.params.id), req.body.year, req.body.month, req.session.user.is_decoy);
        logActivity(req.session.user.id, 'generate_payroll', 'staff', parseInt(req.params.id), null, req.ip);
        res.json({ success: true, transaction_id: result });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Failed to generate payroll' });
    }
});

module.exports = router;
