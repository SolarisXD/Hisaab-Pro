/**
 * Path Utility — Hisaab Pro
 * 
 * Centralizes directory detection for absolute USB portability.
 * Detects the root directory of the application regardless of where it's launched.
 */

'use strict';

const path = require('path');

/**
 * The Root directory where the application is installed.
 * In development, it's the folder containing package.json.
 * In packaged Electron, it's the folder containing the executable.
 */
const appRootDir = path.resolve(__dirname, '../../');

/**
 * Resolve a path relative to the application root.
 */
function resolvePath(...segments) {
    const validSegments = segments.filter(segment => typeof segment === 'string');
    return path.join(appRootDir, ...validSegments);
}

/**
 * Get the data directory where databases and uploads are stored.
 */
function getDataDir() {
    return resolvePath('data');
}

/**
 * Get the uploads directory.
 */
function getUploadsDir() {
    return resolvePath('data', 'uploads');
}

module.exports = {
    appRootDir,
    resolvePath,
    getDataDir,
    getUploadsDir
};
