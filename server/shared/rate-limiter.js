/**
 * Rate Limiter Configuration — Hisaab Pro
 * 
 * Prevents brute-force attacks on sensitive endpoints.
 */

'use strict';

const rateLimit = require('express-rate-limit');

/**
 * standardLimiter: 200 requests per 15 minutes per IP
 */
const standardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: 'Too many requests, please try again later.' }
});

/**
 * loginLimiter: 5 attempts per 15 minutes per IP
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again after 15 minutes.' }
});

module.exports = {
    standardLimiter,
    loginLimiter
};
