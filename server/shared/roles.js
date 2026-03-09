/**
 * Role Definitions — Hisaab Pro
 * 
 * Defines user roles and their permissions.
 * v1 uses only OWNER; CASHIER and ACCOUNTANT are defined for v2.
 */

'use strict';

var ROLES = {
    OWNER: 'owner',
    CASHIER: 'cashier',
    ACCOUNTANT: 'accountant'
};

var PERMISSIONS = {
    owner: {
        can_view_dashboard: true,
        can_manage_sales: true,
        can_manage_payments: true,
        can_manage_accounts: true,
        can_view_reports: true,
        can_export_pdf: true,
        can_manage_users: true,
        can_manage_settings: true,
        can_manage_sync: true,
        can_view_audit_log: true
    },
    cashier: {
        can_view_dashboard: true,
        can_manage_sales: true,
        can_manage_payments: true,
        can_manage_accounts: false,
        can_view_reports: false,
        can_export_pdf: true,
        can_manage_users: false,
        can_manage_settings: false,
        can_manage_sync: false,
        can_view_audit_log: false
    },
    accountant: {
        can_view_dashboard: true,
        can_manage_sales: false,
        can_manage_payments: false,
        can_manage_accounts: true,
        can_view_reports: true,
        can_export_pdf: true,
        can_manage_users: false,
        can_manage_settings: false,
        can_manage_sync: false,
        can_view_audit_log: true
    }
};

/**
 * Check if a role has a specific permission
 * @param {string} role - The user role
 * @param {string} permission - The permission key
 * @returns {boolean}
 */
function hasPermission(role, permission) {
    if (!PERMISSIONS[role]) return false;
    return PERMISSIONS[role][permission] === true;
}

module.exports = {
    ROLES: ROLES,
    PERMISSIONS: PERMISSIONS,
    hasPermission: hasPermission
};
