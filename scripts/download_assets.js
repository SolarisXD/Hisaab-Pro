/**
 * download_assets.js — Hisaab Pro Asset Downloader
 * 
 * RUN THIS ONLY IF INTERNET IS AVAILABLE.
 * Downloads required libraries to ensure the system works offline.
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const ASSETS = [
    {
        name: 'chart.min.js',
        url: 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js'
    },
    {
        name: 'jspdf.umd.min.js',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    },
    {
        name: 'html2canvas.min.js',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    }
];

const ASSETS_DIR = path.join(__dirname, 'client', 'assets');

if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

console.log('[Assets] Starting downloads...');

let completed = 0;

ASSETS.forEach(asset => {
    const filePath = path.join(ASSETS_DIR, asset.name);
    const file = fs.createWriteStream(filePath);

    https.get(asset.url, response => {
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log(`  ✅ Downloaded: ${asset.name}`);
            completed++;
            if (completed === ASSETS.length) {
                console.log('\n[Assets] All libraries downloaded successfully!');
                process.exit(0);
            }
        });
    }).on('error', err => {
        fs.unlink(filePath);
        console.error(`  ❌ Error downloading ${asset.name}: ${err.message}`);
    });
});
