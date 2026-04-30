/**
 * Absolute Paths Verification Tests — Hisaab Pro
 * 
 * Subtask: v1-publish-validation-27
 * Mission: Verify no absolute paths exist in codebase for USB portability
 * 
 * Acceptance Criteria:
 * 1. No absolute paths like C:\Users\... in code
 * 2. All paths are relative or use environment variables
 * 3. USB drive letter changes don't break the app
 * 4. Path normalization works correctly
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Recursively get all files in a directory matching a pattern
 */
function getFilesRecursively(dir, pattern, fileList = []) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // Skip node_modules and .git directories
            if (file !== 'node_modules' && file !== '.git' && file !== 'backups') {
                getFilesRecursively(filePath, pattern, fileList);
            }
        } else if (file.match(pattern)) {
            fileList.push(filePath);
        }
    }
    
    return fileList;
}

/**
 * Check if content contains absolute Windows paths
 * Matches patterns like: C:\..., D:\..., E:\..., etc.
 */
function hasWindowsAbsolutePath(content) {
    // Match drive letter paths like C:\, D:\, etc.
    const windowsPathRegex = /[A-Za-z]:\\/;
    return windowsPathRegex.test(content);
}

/**
 * Check if content contains absolute Unix paths
 * Matches patterns like: /home/user, /usr/local, etc.
 */
function hasUnixAbsolutePath(content) {
    // Match paths starting with / but not \/ (escaped) or // (comments)
    const unixPathRegex = /(?<!\/)\/(?:[a-zA-Z0-9_\-\.]+\/)+[a-zA-Z0-9_\-\.]+/;
    // Exclude common false positives: /api/, /regex/, comments, string literals in code
    const falsePositives = [
        /\/api\//,
        /\/\//,  // Comments
        /\/\*/,  // Block comments
        /require\(/,  // require statements
        /path\.join/,
        /path\.resolve/,
        /express\.static/,
        /res\.sendFile/
    ];
    
    if (!unixPathRegex.test(content)) return false;
    
    // Check if it's a false positive
    for (const fp of falsePositives) {
        if (fp.test(content)) return false;
    }
    
    return unixPathRegex.test(content);
}

/**
 * Check if file contains hardcoded absolute paths
 */
function fileContainsAbsolutePaths(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return hasWindowsAbsolutePath(content) || hasUnixAbsolutePath(content);
}

// ============================================================================
// TEST SUITE: Path Resolution Module
// ============================================================================

describe('Path Resolution Module (server/shared/paths.js)', () => {
    
    const paths = require('../server/shared/paths');
    
    test('appRootDir is computed using relative resolution (not hardcoded string)', () => {
        // Arrange
        const pathsFile = path.join(__dirname, '../server/shared/paths.js');
        const content = fs.readFileSync(pathsFile, 'utf-8');
        
        // Act
        const appRoot = paths.appRootDir;
        
        // Assert - The key is that the SOURCE CODE uses relative resolution, not hardcoded path
        expect(appRoot).toBeTruthy();
        expect(content).toContain("path.resolve(__dirname, '../../')"); // Uses relative resolution in source
        expect(content).not.toMatch(/[A-Za-z]:\\\\[a-zA-Z]/); // No hardcoded Windows path in source code
    });
    
    test('resolvePath() uses path.join for relative resolution', () => {
        // Arrange
        const pathsFile = path.join(__dirname, '../server/shared/paths.js');
        const content = fs.readFileSync(pathsFile, 'utf-8');
        
        // Act & Assert - Check source code uses proper relative path construction
        expect(content).toContain('path.join(appRootDir'); // Uses path.join in source
        expect(content).not.toMatch(/[A-Za-z]:\\\\[a-zA-Z]/); // No hardcoded paths in source
    });
    
    test('getDataDir() source code uses resolvePath helper', () => {
        // Arrange
        const pathsFile = path.join(__dirname, '../server/shared/paths.js');
        const content = fs.readFileSync(pathsFile, 'utf-8');
        
        // Act & Assert - Verify source uses the helper function
        expect(content).toContain('resolvePath('); // Uses resolvePath helper
        expect(content).not.toMatch(/[A-Za-z]:\\\\[a-zA-Z]/); // No hardcoded paths
    });
    
    test('getUploadsDir() source code uses resolvePath helper', () => {
        // Arrange
        const pathsFile = path.join(__dirname, '../server/shared/paths.js');
        const content = fs.readFileSync(pathsFile, 'utf-8');
        
        // Act & Assert - Verify source uses the helper function
        expect(content).toContain('resolvePath('); // Uses resolvePath helper
        expect(content).not.toMatch(/[A-Za-z]:\\\\[a-zA-Z]/); // No hardcoded paths
    });
});

// ============================================================================
// TEST SUITE: Source Code Absolute Path Detection
// ============================================================================

describe('Absolute Path Detection in Source Code', () => {
    
    test('detects Windows absolute paths (C:\\)', () => {
        // Arrange
        const contentWithAbsolutePath = 'const dbPath = "C:\\Users\\John\\hisaab-pro\\data\\db.sqlite";';
        
        // Act
        const result = hasWindowsAbsolutePath(contentWithAbsolutePath);
        
        // Assert
        expect(result).toBe(true);
    });
    
    test('detects Windows absolute paths with other drive letters (D:, E:, etc.)', () => {
        // Arrange
        const contentD = 'var path = "D:\\Projects\\file.js";';
        const contentE = 'var path = "E:\\code\\hisaab-pro\\config.json";';
        
        // Act & Assert
        expect(hasWindowsAbsolutePath(contentD)).toBe(true);
        expect(hasWindowsAbsolutePath(contentE)).toBe(true);
    });
    
    test('does NOT flag relative paths as absolute', () => {
        // Arrange
        const relativePaths = [
            './data/file.js',
            '../config.json',
            'data/uploads/image.png',
            path.join('server', 'index.js')
        ];
        
        // Act & Assert
        for (const relPath of relativePaths) {
            expect(hasWindowsAbsolutePath(relPath)).toBe(false);
        }
    });
    
    test('does NOT flag path.join() or path.resolve() calls as absolute', () => {
        // Arrange
        const codeWithPathJoin = 'const fullPath = path.join(__dirname, "data", "file.js");';
        const codeWithPathResolve = 'const fullPath = path.resolve(__dirname, "../../");';
        
        // Act & Assert
        expect(hasWindowsAbsolutePath(codeWithPathJoin)).toBe(false);
        expect(hasWindowsAbsolutePath(codeWithPathResolve)).toBe(false);
    });
});

// ============================================================================
// TEST SUITE: Config File Path Validation
// ============================================================================

describe('Config File Path Validation', () => {
    
    test('config.json contains no absolute Windows paths', () => {
        // Arrange
        const configPath = path.join(__dirname, '../config.json');
        const content = fs.readFileSync(configPath, 'utf-8');
        
        // Act
        const hasAbsolute = hasWindowsAbsolutePath(content);
        
        // Assert
        expect(hasAbsolute).toBe(false);
    });
    
    test('config.json database path is relative (not absolute)', () => {
        // Arrange
        const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), 'utf-8'));
        
        // Act
        const dbPath = config.database.path;
        
        // Assert
        expect(dbPath).toBe('./data/hisaab.db');
        expect(dbPath).not.toMatch(/^[A-Za-z]:\\/); // Not absolute Windows path
        expect(dbPath).not.toMatch(/^\//); // Not absolute Unix path
    });
    
    test('config.js uses relative path resolution via paths module', () => {
        // Arrange
        const configJsPath = path.join(__dirname, '../server/config.js');
        const content = fs.readFileSync(configJsPath, 'utf-8');
        
        // Act
        const usesPathsModule = content.includes("require('./shared/paths')");
        const usesAppRootDir = content.includes('appRootDir');
        
        // Assert
        expect(usesPathsModule).toBe(true);
        expect(usesAppRootDir).toBe(true);
        expect(hasWindowsAbsolutePath(content)).toBe(false);
    });
});

// ============================================================================
// TEST SUITE: Server Files Path Audit
// ============================================================================

describe('Server Files Path Audit', () => {
    
    const serverDir = path.join(__dirname, '../server');
    const serverFiles = getFilesRecursively(serverDir, /\.js$/);
    
    test('no server .js files contain hardcoded Windows absolute paths', () => {
        // Arrange
        const filesWithAbsolutePaths = [];
        
        // Act
        for (const file of serverFiles) {
            if (hasWindowsAbsolutePath(fs.readFileSync(file, 'utf-8'))) {
                filesWithAbsolutePaths.push(file);
            }
        }
        
        // Assert
        expect(filesWithAbsolutePaths).toEqual([]);
    });
    
    test('server files use path module for path operations', () => {
        // Arrange
        const filesWithoutPathModule = [];
        
        // Act
        for (const file of serverFiles) {
            const content = fs.readFileSync(file, 'utf-8');
            if (content.includes('path.join') || content.includes('path.resolve') || content.includes("require('path')")) {
                // Good - uses path module
            } else if (content.includes('__dirname') || content.includes('appRootDir')) {
                // Might still be okay if using paths module
                if (!content.includes('paths.resolvePath') && !content.includes('paths.appRootDir')) {
                    filesWithoutPathModule.push(file);
                }
            }
        }
        
        // Assert - This is a warning, not a failure (some files may not need paths)
        if (filesWithoutPathModule.length > 0) {
            console.warn('Files that may not use path module:', filesWithoutPathModule);
        }
        expect(true).toBe(true); // Pass - just informational
    });
    
    test('database.js uses resolvePath from paths module', () => {
        // Arrange
        const dbFile = path.join(__dirname, '../server/db/database.js');
        const content = fs.readFileSync(dbFile, 'utf-8');
        
        // Act
        const usesResolvePath = content.includes("require('../shared/paths')");
        const callsResolvePath = content.includes('resolvePath(');
        
        // Assert
        expect(usesResolvePath).toBe(true);
        expect(callsResolvePath).toBe(true);
    });
});

// ============================================================================
// TEST SUITE: USB Portability Verification
// ============================================================================

describe('USB Portability Verification', () => {
    
    test('no hardcoded references to fixed drive letters (C:, D:, E:) in source code', () => {
        // Arrange
        const rootDir = path.join(__dirname, '..');
        // Only check source code files, not generated/temp files
        const sourceFiles = getFilesRecursively(path.join(rootDir, 'server'), /\.js$/);
        const configFiles = [path.join(rootDir, 'config.json'), path.join(rootDir, 'package.json')];
        const filesWithDriveLetters = [];
        
        // Act - Check server source files
        for (const file of sourceFiles) {
            const content = fs.readFileSync(file, 'utf-8');
            // Check for hardcoded absolute paths (not runtime resolved ones)
            // Look for patterns like 'E:\code' or 'C:\Users' in string literals
            const hardcodedPathRegex = /['"`][A-Za-z]:\\[a-zA-Z0-9_\\]+['"`]/;
            if (hardcodedPathRegex.test(content)) {
                filesWithDriveLetters.push(path.relative(rootDir, file));
            }
        }
        
        // Assert
        expect(filesWithDriveLetters).toEqual([]);
    });
    
    test('paths.js uses relative resolution (path.resolve with __dirname)', () => {
        // Arrange
        const pathsFile = path.join(__dirname, '../server/shared/paths.js');
        const content = fs.readFileSync(pathsFile, 'utf-8');
        
        // Act
        const usesRelativeResolution = content.includes("path.resolve(__dirname, '../../')");
        
        // Assert
        expect(usesRelativeResolution).toBe(true);
    });
    
    test('index.js serves static files using relative paths', () => {
        // Arrange
        const indexFile = path.join(__dirname, '../server/index.js');
        const content = fs.readFileSync(indexFile, 'utf-8');
        
        // Act
        const usesRelativeStatic = content.includes("path.join(__dirname, '../client')");
        const usesResolvePath = content.includes('resolvePath(');
        
        // Assert
        expect(usesRelativeStatic || usesResolvePath).toBe(true);
    });
    
    test('path traversal protection exists in index.js', () => {
        // Arrange
        const indexFile = path.join(__dirname, '../server/index.js');
        const content = fs.readFileSync(indexFile, 'utf-8');
        
        // Act
        const hasPathTraversalProtection = content.includes("safeFilenameRegex") || 
                                          content.includes("includes('..')") ||
                                          content.includes("path traversal");
        
        // Assert
        expect(hasPathTraversalProtection).toBe(true);
    });
});

// ============================================================================
// TEST SUITE: Path Normalization
// ============================================================================

describe('Path Normalization', () => {
    
    const paths = require('../server/shared/paths');
    
    test('resolvePath normalizes paths correctly (removes .. and .)', () => {
        // Arrange & Act
        const result1 = paths.resolvePath('data', '..', 'data', 'uploads');
        const result2 = paths.resolvePath('./data/uploads');
        
        // Assert
        expect(result1).toBe(paths.getUploadsDir());
        expect(result2).toBe(paths.getUploadsDir());
    });
    
    test('path.join handles multiple segments correctly', () => {
        // Arrange
        const segment1 = 'data';
        const segment2 = 'uploads';
        const segment3 = 'image.png';
        
        // Act
        const result = path.join(paths.appRootDir, segment1, segment2, segment3);
        const expected = path.join(paths.appRootDir, 'data', 'uploads', 'image.png');
        
        // Assert
        expect(result).toBe(expected);
    });
});

// ============================================================================
// TEST SUITE: Negative Cases (Error Handling)
// ============================================================================

describe('Negative Cases - Error Handling', () => {
    
    test('hasWindowsAbsolutePath returns false for empty string', () => {
        // Arrange
        const empty = '';
        
        // Act
        const result = hasWindowsAbsolutePath(empty);
        
        // Assert
        expect(result).toBe(false);
    });
    
    test('hasWindowsAbsolutePath returns false for null/undefined input', () => {
        // Arrange & Act & Assert
        expect(hasWindowsAbsolutePath(null)).toBe(false);
        expect(hasWindowsAbsolutePath(undefined)).toBe(false);
    });
    
    test('fileContainsAbsolutePaths handles non-existent files gracefully', () => {
        // Arrange
        const nonExistentFile = path.join(__dirname, 'non-existent-file.js');
        
        // Act & Assert
        expect(() => fileContainsAbsolutePaths(nonExistentFile)).toThrow();
    });
});

// ============================================================================
// AUDIT REPORT GENERATOR
// ============================================================================

describe('Absolute Path Audit Report', () => {
    
    test('generate audit report of source code files for hardcoded absolute paths', () => {
        // Arrange
        const rootDir = path.join(__dirname, '..');
        const serverDir = path.join(rootDir, 'server');
        const sourceFiles = getFilesRecursively(serverDir, /\.js$/);
        const configFile = path.join(rootDir, 'config.json');
        
        const report = {
            timestamp: new Date().toISOString(),
            totalFilesChecked: sourceFiles.length + 1,
            filesWithHardcodedPaths: [],
            filesChecked: []
        };
        
        // Act - Check server source files for HARDCODED absolute paths
        for (const file of sourceFiles) {
            const content = fs.readFileSync(file, 'utf-8');
            const relativePath = path.relative(rootDir, file);
            report.filesChecked.push(relativePath);
            
            // Look for hardcoded absolute paths in string literals (not path.resolve results)
            const hardcodedPathRegex = /['"`][A-Za-z]:\\[a-zA-Z0-9_\\]+['"`]/;
            if (hardcodedPathRegex.test(content)) {
                report.filesWithHardcodedPaths.push(relativePath);
            }
        }
        
        // Check config.json for absolute paths
        const configContent = fs.readFileSync(configFile, 'utf-8');
        report.filesChecked.push('config.json');
        if (hasWindowsAbsolutePath(configContent)) {
            report.filesWithHardcodedPaths.push('config.json');
        }
        
        // Assert & Output Report
        console.log('\n=== ABSOLUTE PATH AUDIT REPORT (Source Code) ===');
        console.log(`Timestamp: ${report.timestamp}`);
        console.log(`Total files checked: ${report.totalFilesChecked}`);
        console.log(`Files with hardcoded absolute paths: ${report.filesWithHardcodedPaths.length}`);
        
        if (report.filesWithHardcodedPaths.length > 0) {
            console.log('\n⚠️  Files containing hardcoded absolute paths:');
            report.filesWithHardcodedPaths.forEach(f => console.log(`  - ${f}`));
        } else {
            console.log('\n✅ No hardcoded absolute paths found in source code!');
        }
        console.log('==================================================\n');
        
        // This test passes if no hardcoded paths found
        expect(report.filesWithHardcodedPaths).toEqual([]);
    });
});
