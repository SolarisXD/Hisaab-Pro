/**
 * Schema Validation Utility — Hisaab Pro
 * 
 * Uses Zod to validate all incoming API request bodies.
 * Ensures data integrity and prevents injection or bad data.
 */

'use strict';

const { z } = require('zod');

/**
 * Common regex/formats
 */
const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD

/**
 * Sale Schema
 */
const saleSchema = z.object({
    date: z.string().regex(dateRegex, "Invalid date format (YYYY-MM-DD)"),
    customer_account_id: z.number().int().positive().nullable().optional(),
    total: z.number().nonnegative(),
    amount_paid: z.number().nonnegative().default(0),
    discount: z.number().nonnegative().default(0),
    tax_percent: z.number().min(0).max(100).optional(),
    tax_amount: z.number().nonnegative().optional(),
    notes: z.string().max(500).nullable().optional(),
    ref_no: z.string().max(50).nullable().optional(),
    invoice_no: z.string().max(50).nullable().optional(),
    images: z.array(z.string()).optional()
});

/**
 * Purchase Schema
 */
const purchaseSchema = z.object({
    date: z.string().regex(dateRegex, "Invalid date format (YYYY-MM-DD)"),
    supplier_account_id: z.number().int().positive().nullable().optional(),
    total: z.number().nonnegative(),
    amount_paid: z.number().nonnegative().default(0),
    discount: z.number().nonnegative().default(0),
    tax_percent: z.number().min(0).max(100).optional(),
    tax_amount: z.number().nonnegative().optional(),
    notes: z.string().max(500).nullable().optional(),
    ref_no: z.string().max(50).nullable().optional(),
    invoice_no: z.string().max(50).nullable().optional(),
    images: z.array(z.string()).optional()
});

/**
 * Payment Schema
 */
const paymentSchema = z.object({
    date: z.string().regex(dateRegex, "Invalid date format (YYYY-MM-DD)"),
    account_id: z.number().int().positive(),
    amount: z.number().positive(),
    type: z.enum(['in', 'out']),
    mode: z.enum(['cash', 'bank', 'other']).default('cash'),
    reference: z.string().max(100).nullable().optional(),
    notes: z.string().max(500).nullable().optional()
});

/**
 * Account Schema
 */
const accountSchema = z.object({
    name: z.string().min(1).max(100),
    type_slug: z.string().min(1).max(50),
    phone: z.string().max(20).nullable().optional(),
    address: z.string().max(200).nullable().optional(),
    initial_balance: z.number().default(0),
    is_decoy: z.boolean().optional()
});

/**
 * Staff Schema
 */
const staffSchema = z.object({
    name: z.string().min(1).max(100),
    phone: z.string().max(20).nullable().optional(),
    address: z.string().max(200).nullable().optional(),
    monthly_salary: z.number().nonnegative().default(0),
    daily_wage: z.number().nonnegative().default(0)
});

/**
 * Attendance Schema
 */
const attendanceSchema = z.object({
    date: z.string().regex(dateRegex, "Invalid date format (YYYY-MM-DD)"),
    status: z.enum(['present', 'absent', 'half-day', 'leave']),
    notes: z.string().max(200).nullable().optional()
});

/**
 * Generic Validation Middleware
 */
function validate(schema) {
    return (req, res, next) => {
        try {
            // Parse and replace req.body with validated data (for coercion/defaults)
            req.body = schema.parse(req.body);
            next();
        } catch (err) {
            if (err instanceof z.ZodError) {
                return res.status(400).json({
                    error: "Validation failed",
                    details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
                });
            }
            next(err);
        }
    };
}

module.exports = {
    saleSchema,
    purchaseSchema,
    paymentSchema,
    accountSchema,
    staffSchema,
    attendanceSchema,
    validate
};
