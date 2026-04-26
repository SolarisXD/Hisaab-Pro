/**
 * Upload Routes — Hisaab Pro
 * 
 * POST /api/v1/uploads/bills — Upload images associated with bills
 */

'use strict';

var express = require('express');
var router = express.Router();
var { requireAuth } = require('../auth/auth.middleware');
var multer = require('multer');
var fs = require('fs');
var path = require('path');
const { resolvePath } = require('../../shared/paths');

// Ensure uploads folder exists
var uploadDir = resolvePath('data', 'uploads', 'bills');
console.log('[Uploads] Storage path initialized at:', uploadDir);
if (!fs.existsSync(uploadDir)) {
    console.log('[Uploads] Creating missing directory:', uploadDir);
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config
var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        var ext = path.extname(file.originalname);
        var uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'bill-' + uniqueSuffix + ext);
    }
});

var upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
    fileFilter: function (req, file, cb) {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

router.use(requireAuth);

/**
 * POST /bills - Upload multiple images
 */
router.post('/bills', upload.array('images', 20), function(req, res) {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        
        var urls = req.files.map(function(file) {
            console.log('[Uploads] File saved:', file.path);
            return '/data/uploads/bills/' + file.filename;
        });
        
        res.json({ success: true, urls: urls });
    } catch (err) {
        console.error('[Uploads] Post-upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

module.exports = router;
