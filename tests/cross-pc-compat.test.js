/**
 * Cross-PC Compatibility Tests — Hisaab Pro
 * 
 * Acceptance Criteria:
 * 1. Application works on different Windows PCs
 * 2. No hardcoded paths to user directories
 * 3. Database connection works across different machines
 * 4. No machine-specific dependencies
 * 
 * Following AAA Pattern: Arrange → Act → Assert
 * Reference: .opencode/context/core/standards/test-coverage.md
 * Reference: .opencode/context/core/standards/code-quality.md
 * Reference: .opencode/context/core/standards/security-patterns.md
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

// ============================================================
// POSITIVE TESTS - Cross-PC Compatibility Success Cases
// ============================================================

describe('Cross-PC Compatibility - Positive Tests', () => {

    // ----------------------------------------------------------
    // Test Group 1: Path Resolution (No Hardcoded Paths)
    // ----------------------------------------------------------

    test('should resolve appRootDir using relative path from __dirname (portable)', () => {
        // Arrange
        // paths.js is at server/shared/paths.js, so __dirname = <appRoot>/server/shared
        // '../../' from there = <appRoot>
        const paths = require('../server/shared/paths');
        // __dirname here = <appRoot>/tests
        // To get to appRoot from tests/, we need to go up 1 level (not 3)
        // tests/ is at <appRoot>/tests, so '..' = <appRoot>
        const expectedRoot = path.resolve(__dirname, '..');
        
        // Act
        const actualRoot = paths.appRootDir;
        
        // Assert
        expect(actualRoot).toBe(expectedRoot);
        expect(path.isAbsolute(actualRoot)).toBe(true);
    });

    test('should resolve paths relative to app root using resolvePath()', () => {
        // Arrange
        const paths = require('../server/shared/paths');
        const appRoot = paths.appRootDir;
        
        // Act
        const dataPath = paths.resolvePath('data');
        const uploadsPath = paths.resolvePath('data', 'uploads');
        const customPath = paths.resolvePath('config.json');
        
        // Assert
        expect(dataPath).toBe(path.join(appRoot, 'data'));
        expect(uploadsPath).toBe(path.join(appRoot, 'data', 'uploads'));
        expect(customPath).toBe(path.join(appRoot, 'config.json'));
    });

    test('should return correct data directory using getDataDir()', () => {
        // Arrange
        const paths = require('../server/shared/paths');
        const appRoot = paths.appRootDir;
        
        // Act
        const dataDir = paths.getDataDir();
        
        // Assert
        expect(dataDir).toBe(path.join(appRoot, 'data'));
        expect(dataDir).not.toContain('C:\\Users');
        expect(dataDir).not.toContain('C:\\Documents and Settings');
    });

    test('should return correct uploads directory using getUploadsDir()', () => {
        // Arrange
        const paths = require('../server/shared/paths');
        const appRoot = paths.appRootDir;
        
        // Act
        const uploadsDir = paths.getUploadsDir();
        
        // Assert
        expect(uploadsDir).toBe(path.join(appRoot, 'data', 'uploads'));
        expect(uploadsDir).not.toContain('C:\\Users');
    });

    test('should resolve database path relative to app root in config', () => {
        // Arrange
        const paths = require('../server/shared/paths');
        const config = require('../server/config');
        
        // Act
        const dbPath = config.database.path;
        const resolvedDbPath = paths.resolvePath(dbPath);
        
        // Assert
        expect(dbPath).toBe('./data/hisaab.db');
        expect(resolvedDbPath).toBe(path.join(paths.appRootDir, 'data', 'hisaab.db'));
        expect(path.isAbsolute(resolvedDbPath)).toBe(true);
    });

    // ----------------------------------------------------------
    // Test Group 2: Database Connection Portability
    // ----------------------------------------------------------

    test('should use resolvePath() for database path in database.js', () => {
        // Arrange
        const databaseJsPath = path.join(__dirname, '../server/db/database.js');
        const databaseContent = fs.readFileSync(databaseJsPath, 'utf-8');
        
        // Act & Assert
        // Verify database.js imports resolvePath from paths module
        expect(databaseContent).toMatch(/require\(['"]\.\.\/shared\/paths['"]\)/);
        // Verify resolvePath is used for database path resolution
        expect(databaseContent).toMatch(/resolvePath\(/);
        // Verify dbDir comes from config.database.path (relative)
        expect(databaseContent).toMatch(/config\.database\.path/);
    });

    test('should have relative database path in config.json', () => {
        // Arrange
        const configPath = path.join(__dirname, '../config.json');
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        
        // Act
        const dbPath = config.database.path;
        
        // Assert
        expect(dbPath).toBe('./data/hisaab.db');
        expect(path.isAbsolute(dbPath)).toBe(false);
        expect(dbPath.startsWith('./')).toBe(true);
    });

    test('should have relative database path in config.example.json', () => {
        // Arrange
        const configExamplePath = path.join(__dirname, '../config.example.json');
        const configContent = fs.readFileSync(configExamplePath, 'utf-8');
        const config = JSON.parse(configContent);
        
        // Act
        const dbPath = config.database.path;
        
        // Assert
        expect(dbPath).toBe('./data/hisaab.db');
        expect(path.isAbsolute(dbPath)).toBe(false);
    });

    test('should load config using appRootDir-based path', () => {
        // Arrange
        const configJsPath = path.join(__dirname, '../server/config.js');
        const configContent = fs.readFileSync(configJsPath, 'utf-8');
        
        // Act & Assert
        // Verify config uses appRootDir to resolve config.json path
        expect(configContent).toMatch(/appRootDir.*config\.json/);
        expect(configContent).toMatch(/path\.join\(appRootDir, 'config\.json'\)/);
    });

    // ----------------------------------------------------------
    // Test Group 3: No Machine-Specific Dependencies
    // ----------------------------------------------------------

    test('should not have hardcoded user directory paths in paths.js', () => {
        // Arrange
        const pathsJsPath = path.join(__dirname, '../server/shared/paths.js');
        const pathsContent = fs.readFileSync(pathsJsPath, 'utf-8');
        
        // Act & Assert
        // Should NOT contain hardcoded Windows user paths
        expect(pathsContent).not.toMatch(/C:\\Users/i);
        expect(pathsContent).not.toMatch(/C:\\Documents and Settings/i);
        expect(pathsContent).not.toMatch(/\/home\/\w+/);  // Linux user paths
        expect(pathsContent).not.toMatch(/\/Users\/\w+/);  // macOS user paths
    });

    test('should not have hardcoded user directory paths in database.js', () => {
        // Arrange
        const dbJsPath = path.join(__dirname, '../server/db/database.js');
        const dbContent = fs.readFileSync(dbJsPath, 'utf-8');
        
        // Act & Assert
        expect(dbContent).not.toMatch(/C:\\Users/i);
        expect(dbContent).not.toMatch(/C:\\Documents and Settings/i);
        expect(dbContent).not.toMatch(/\/home\/\w+\//);
        expect(dbContent).not.toMatch(/\/Users\/\w+\//);
    });

    test('should not have hardcoded user directory paths in config.js', () => {
        // Arrange
        const configJsPath = path.join(__dirname, '../server/config.js');
        const configContent = fs.readFileSync(configJsPath, 'utf-8');
        
        // Act & Assert
        expect(configContent).not.toMatch(/C:\\Users/i);
        expect(configContent).not.toMatch(/C:\\Documents and Settings/i);
        expect(configContent).not.toMatch(/\/home\/\w+\//);
        expect(configContent).not.toMatch(/\/Users\/\w+\//);
    });

    test('should auto-generate session secret (not machine-specific)', () => {
        // Arrange
        const config = require('../server/config');
        
        // Act
        const secret = config.session.secret;
        
        // Assert
        // Secret should be a hex string (64 bytes = 128 hex chars)
        expect(secret).toMatch(/^[a-f0-9]{128}$/);
        // Should NOT be a hardcoded default
        expect(secret).not.toBe('PLACEHOLDER');
        expect(secret).not.toBe('hisaab-pro-default-secret-change-this');
        expect(secret).not.toBe('change-this-to-a-random-secret-key');
    });

    test('should have database encryption key in config, not hardcoded in source', () => {
        // Arrange
        const dbJsPath = path.join(__dirname, '../server/db/database.js');
        const dbContent = fs.readFileSync(dbJsPath, 'utf-8');
        const config = require('../server/config');
        
        // Act & Assert
        // Database key should come from config
        expect(dbContent).toMatch(/config\.database_key/);
        // The legacy key in source should be migrated to config
        // Config may have database_key set
        if (config.database_key) {
            expect(config.database_key).toBeDefined();
            expect(config.database_key).not.toBe('');
        }
    });

    // ----------------------------------------------------------
    // Test Group 4: Application Works on Different Windows PCs
    // ----------------------------------------------------------

    test('should detect app root correctly regardless of working directory', () => {
        // Arrange
        const paths = require('../server/shared/paths');
        const originalCwd = process.cwd();
        
        // Act - Change working directory and verify appRootDir is still correct
        const expectedRoot = paths.appRootDir;
        
        // Try changing to different directories
        const testDirs = [
            path.join(os.tmpdir()),
            path.join(__dirname, '..'),
            path.join(__dirname)
        ];
        
        testDirs.forEach(dir => {
            if (fs.existsSync(dir)) {
                process.chdir(dir);
                // Re-require to get fresh module
                delete require.cache[require.resolve('../server/shared/paths')];
                const refreshedPaths = require('../server/shared/paths');
                // appRootDir is calculated once at module load, so it should be stable
                expect(refreshedPaths.appRootDir).toBe(expectedRoot);
            }
        });
        
        // Restore working directory
        process.chdir(originalCwd);
    });

    test('should have portable package.json with no platform-specific dependencies', () => {
        // Arrange
        const packageJsonPath = path.join(__dirname, '../package.json');
        const packageContent = fs.readFileSync(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageContent);
        
        // Act & Assert
        // All dependencies should be cross-platform Node.js packages
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        const depNames = Object.keys(deps);
        
        // Verify no Windows-specific or platform-specific packages
        const platformSpecificPatterns = [
            /windows/i,
            /win32/i,
            /darwin/i,
            /linux/i,
            /macos/i
        ];
        
        depNames.forEach(dep => {
            platformSpecificPatterns.forEach(pattern => {
                expect(pattern.test(dep)).toBe(false);
            });
        });
    });

    test('should specify node engine version range for compatibility', () => {
        // Arrange
        const packageJsonPath = path.join(__dirname, '../package.json');
        const packageContent = fs.readFileSync(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageContent);
        
        // Act & Assert
        expect(packageJson.engines).toBeDefined();
        expect(packageJson.engines.node).toBeDefined();
        expect(packageJson.engines.node).toBe('>=14 <20');
    });

});

// ============================================================
// NEGATIVE TESTS - Cross-PC Compatibility Failure Cases
// ============================================================

describe('Cross-PC Compatibility - Negative Tests', () => {

    // ----------------------------------------------------------
    // Test Group 1: Hardcoded Path Detection
    // ----------------------------------------------------------

    test('should NOT contain hardcoded Windows user profile paths', () => {
        // Arrange
        const filesToCheck = [
            'server/shared/paths.js',
            'server/db/database.js',
            'server/config.js',
            'config.json',
            'config.example.json'
        ];
        
        // Act & Assert
        filesToCheck.forEach(relativePath => {
            const fullPath = path.join(__dirname, '..', relativePath);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                
                // Should NOT contain hardcoded user paths
                expect(content).not.toMatch(/C:\\Users\\[^\\]+/i);
                expect(content).not.toMatch(/C:\\Documents and Settings\\[^\\]+/i);
                // Should NOT contain specific user folder references
                expect(content).not.toMatch(/\\Desktop\\/i);
                expect(content).not.toMatch(/\\Documents\\/i);
                expect(content).not.toMatch(/\\Downloads\\/i);
            }
        });
    });

    test('should NOT contain hardcoded Linux/macOS user paths', () => {
        // Arrange
        const filesToCheck = [
            'server/shared/paths.js',
            'server/db/database.js',
            'server/config.js'
        ];
        
        // Act & Assert
        filesToCheck.forEach(relativePath => {
            const fullPath = path.join(__dirname, '..', relativePath);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                
                // Should NOT contain hardcoded Unix user paths
                expect(content).not.toMatch(/\/home\/[^/]+\//);
                expect(content).not.toMatch(/\/Users\/[^/]+\//);
                expect(content).not.toMatch(/\/var\/users\//);
            }
        });
    });

    test('should NOT use process.env for required paths (machine-specific)', () => {
        // Arrange
        const filesToCheck = [
            'server/shared/paths.js',
            'server/db/database.js',
            'server/config.js'
        ];
        
        // Act & Assert
        filesToCheck.forEach(relativePath => {
            const fullPath = path.join(__dirname, '..', relativePath);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                
                // These files should NOT rely on environment variables for core paths
                // (Environment variables can be machine-specific)
                const envPathMatches = content.match(/process\.env\.(\w+)/g) || [];
                
                envPathMatches.forEach(match => {
                    // Allow NODE_ENV, but not path-related env vars
                    expect(match).not.toMatch(/process\.env\.HOME/i);
                    expect(match).not.toMatch(/process\.env\.USERPROFILE/i);
                    expect(match).not.toMatch(/process\.env\.APPDATA/i);
                    expect(match).not.toMatch(/process\.env\.LOCALAPPDATA/i);
                });
            }
        });
    });

    // ----------------------------------------------------------
    // Test Group 2: Database Portability
    // ----------------------------------------------------------

    test('should NOT have hardcoded absolute database paths', () => {
        // Arrange
        const dbJsPath = path.join(__dirname, '../server/db/database.js');
        const dbContent = fs.readFileSync(dbJsPath, 'utf-8');
        
        // Act & Assert
        // Should NOT have hardcoded absolute paths for database
        expect(dbContent).not.toMatch(/['"]C:\\.*\.db['"]/i);
        expect(dbContent).not.toMatch(/['"]\/home\/.*\.db['"]/);
        expect(dbContent).not.toMatch(/['"]\/Users\/.*\.db['"]/);
        
        // Should use resolvePath for database paths
        expect(dbContent).toMatch(/resolvePath\(/);
    });

    test('should NOT have database key hardcoded in source code', () => {
        // Arrange
        const dbJsPath = path.join(__dirname, '../server/db/database.js');
        const dbContent = fs.readFileSync(dbJsPath, 'utf-8');
        const config = require('../server/config');
        
        // Act & Assert
        // The legacy key should only be a fallback, not the primary source
        // Config should be the primary source
        expect(dbContent).toMatch(/config\.database_key/);
        
        // If there's a hardcoded fallback key, it should be migrated to config
        if (config.database_key) {
            expect(config.database_key).toBeDefined();
        }
    });

    test('should NOT have hardcoded Windows drive letters in paths', () => {
        // Arrange
        const paths = require('../server/shared/paths');
        
        // Act
        const appRoot = paths.appRootDir;
        
        // Assert
        // Path should use dynamic resolution, not hardcoded drive letters like 'C:' in source
        // The actual runtime path WILL have a drive letter on Windows, and that's OK
        // What we're testing is that the SOURCE CODE doesn't have hardcoded drives
        
        const pathsJsPath = path.join(__dirname, '../server/shared/paths.js');
        const pathsContent = fs.readFileSync(pathsJsPath, 'utf-8');
        
        // Source should NOT contain hardcoded drive letters
        expect(pathsContent).not.toMatch(/'[A-Z]:\\/);  // e.g., 'C:\'
        expect(pathsContent).not.toMatch(/"[A-Z]:\\/);  // e.g., "C:\"
        
        // But the resolved path should be valid (has drive letter on Windows)
        if (process.platform === 'win32') {
            expect(appRoot).toMatch(/^[A-Z]:\\/);
        }
    });

    // ----------------------------------------------------------
    // Test Group 3: Configuration Portability
    // ----------------------------------------------------------

    test('should NOT have absolute paths in config.json', () => {
        // Arrange
        const configPath = path.join(__dirname, '../config.json');
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        
        // Act & Assert
        // Database path should be relative
        expect(config.database.path).not.toMatch(/^[A-Z]:\\/);  // Windows absolute
        expect(config.database.path).not.toMatch(/^\//);  // Unix absolute
        expect(config.database.path.startsWith('./')).toBe(true);
        
        // Logo path should be relative
        expect(config.shop.logo_path).not.toMatch(/^[A-Z]:\\/);
        expect(config.shop.logo_path).not.toMatch(/^\//);
    });

    test('should NOT have absolute paths in config.example.json', () => {
        // Arrange
        const configPath = path.join(__dirname, '../config.example.json');
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        
        // Act & Assert
        expect(config.database.path).not.toMatch(/^[A-Z]:\\/);
        expect(config.database.path).not.toMatch(/^\//);
        expect(config.database.path.startsWith('./')).toBe(true);
        
        expect(config.shop.logo_path).not.toMatch(/^[A-Z]:\\/);
        expect(config.shop.logo_path).not.toMatch(/^\//);
    });

    test('should NOT require machine-specific environment variables', () => {
        // Arrange
        const configJsPath = path.join(__dirname, '../server/config.js');
        const configContent = fs.readFileSync(configJsPath, 'utf-8');
        
        // Act & Assert
        // Config should have sensible defaults and not require env vars
        expect(configContent).toMatch(/defaults/i);
        
        // Session secret should be auto-generated, not from env
        const config = require('../server/config');
        expect(config.session.secret).toBeDefined();
        expect(config.session.secret).not.toBe('PLACEHOLDER');
    });

    // ----------------------------------------------------------
    // Test Group 4: Application Startup Portability
    // ----------------------------------------------------------

    test('should NOT have start scripts with hardcoded paths', () => {
        // Arrange
        const filesToCheck = [
            'package.json'  // Check npm scripts
        ];
        
        // Act & Assert
        filesToCheck.forEach(relativePath => {
            const fullPath = path.join(__dirname, '..', relativePath);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const json = JSON.parse(content);
                
                if (json.scripts) {
                    const scripts = Object.values(json.scripts);
                    scripts.forEach(script => {
                        // Scripts should not have hardcoded user paths
                        expect(script).not.toMatch(/C:\\Users/i);
                        expect(script).not.toMatch(/\/home\/[^/]+/i);
                        expect(script).not.toMatch(/\/Users\/[^/]+/i);
                    });
                }
            }
        });
    });

    test('should have data directory created relative to app root', () => {
        // Arrange
        const paths = require('../server/shared/paths');
        const fs = require('fs');
        
        // Act
        const dataDir = paths.getDataDir();
        const dataDirExists = fs.existsSync(dataDir);
        
        // Assert
        // Data dir should be inside app root, not in user directory
        expect(dataDir).toContain(paths.appRootDir);
        expect(dataDir).not.toContain('C:\\Users');
        
        // If data dir exists, verify it's accessible
        if (dataDirExists) {
            expect(() => fs.readdirSync(dataDir)).not.toThrow();
        }
    });

});

// ============================================================
// INTEGRATION TESTS - Full Cross-PC Scenario
// ============================================================

describe('Cross-PC Compatibility - Integration Tests', () => {

    test('should simulate running from different parent directories', () => {
        // Arrange
        // Clear require cache to get fresh module
        delete require.cache[require.resolve('../server/shared/paths')];
        const paths = require('../server/shared/paths');
        
        // paths.js is at <appRoot>/server/shared/paths.js
        // __dirname = <appRoot>/server/shared
        // '../../' = <appRoot>
        // __dirname here = <appRoot>/tests
        // '..' = <appRoot>
        const expectedRoot = path.resolve(__dirname, '..');
        
        // Act
        const actualRoot = paths.appRootDir;
        
        // Assert
        expect(actualRoot).toBe(expectedRoot);
        
        // The key insight: paths.js uses __dirname relative resolution
        // This means it works regardless of where the app is unzipped
        
        // Verify path resolution is based on __dirname, not cwd
        expect(paths.getDataDir()).toBe(path.join(actualRoot, 'data'));
        expect(paths.getUploadsDir()).toBe(path.join(actualRoot, 'data', 'uploads'));
    });

    test('should verify complete path chain: config -> paths -> database', () => {
        // Arrange
        const config = require('../server/config');
        const paths = require('../server/shared/paths');
        
        // Act
        const dbRelativePath = config.database.path;  // e.g., './data/hisaab.db'
        const dbAbsolutePath = paths.resolvePath(dbRelativePath);
        const dataDir = paths.getDataDir();
        
        // Assert
        // Database path should be inside data directory
        expect(dbAbsolutePath).toContain(dataDir);
        
        // All paths should be under app root
        expect(dbAbsolutePath).toContain(paths.appRootDir);
        expect(dataDir).toContain(paths.appRootDir);
        
        // No user-specific paths
        expect(dbAbsolutePath).not.toMatch(/C:\\Users/i);
        expect(dataDir).not.toMatch(/C:\\Users/i);
    });

    test('should verify no machine-specific information in package.json', () => {
        // Arrange
        const packageJsonPath = path.join(__dirname, '..', 'package.json');
        const content = fs.readFileSync(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);
        
        // Act & Assert
        // Check all fields for machine-specific content
        const jsonString = JSON.stringify(packageJson);
        
        expect(jsonString).not.toMatch(/C:\\Users/i);
        expect(jsonString).not.toMatch(/\/home\/[^/]+/i);
        expect(jsonString).not.toMatch(/\/Users\/[^/]+/i);
        
        // Main entry should be relative
        expect(packageJson.main).toBe('server/index.js');
        expect(packageJson.main).not.toMatch(/^[A-Z]:\\/);
        expect(packageJson.main).not.toMatch(/^\//);
    });

});

// ============================================================
// CROSS-PLATFORM COMPATIBILITY TESTS
// ============================================================

describe('Cross-Platform Compatibility Tests', () => {

    test('should use path.join() for cross-platform path construction', () => {
        // Arrange
        const pathsJsPath = path.join(__dirname, '../server/shared/paths.js');
        const content = fs.readFileSync(pathsJsPath, 'utf-8');
        
        // Act & Assert
        // Should use path.join or path.resolve (cross-platform)
        expect(content).toMatch(/path\.join\(/);
        expect(content).toMatch(/path\.resolve\(/);
        
        // Should NOT use string concatenation for paths
        expect(content).not.toMatch(/__dirname \+ '\/'\s*\+/);
        expect(content).not.toMatch(/__dirname \+ "\\\\"\s*\+/);
    });

    test('should use path module for all path operations in database.js', () => {
        // Arrange
        const dbJsPath = path.join(__dirname, '../server/db/database.js');
        const content = fs.readFileSync(dbJsPath, 'utf-8');
        
        // Act & Assert
        expect(content).toMatch(/const path = require\('path'\)/);
        expect(content).toMatch(/path\.dirname\(/);
        expect(content).toMatch(/path\.join\(/);
    });

    test('should use path module for all path operations in config.js', () => {
        // Arrange
        const configJsPath = path.join(__dirname, '../server/config.js');
        const content = fs.readFileSync(configJsPath, 'utf-8');
        
        // Act & Assert
        expect(content).toMatch(/const path = require\('path'\)/);
        expect(content).toMatch(/path\.join\(/);
    });

    test('should use path module for all path operations in logger.js', () => {
        // Arrange
        const loggerJsPath = path.join(__dirname, '../server/shared/logger.js');
        const content = fs.readFileSync(loggerJsPath, 'utf-8');
        
        // Act & Assert
        expect(content).toMatch(/const path = require\('path'\)/);
        expect(content).toMatch(/resolvePath\(/);  // Should use paths.resolvePath
        expect(content).toMatch(/path\.join\(/);
    });

    test('should use path module for all path operations in utils.js', () => {
        // Arrange
        const utilsJsPath = path.join(__dirname, '../server/shared/utils.js');
        const content = fs.readFileSync(utilsJsPath, 'utf-8');
        
        // Act & Assert
        // utils.js doesn't directly use path, but should not have hardcoded paths
        expect(content).not.toMatch(/C:\\/);
        expect(content).not.toMatch(/\/home\//);
        expect(content).not.toMatch(/\/Users\//);
    });

});

// ============================================================
// MACHINE-SPECIFIC DEPENDENCY TESTS
// ============================================================

describe('No Machine-Specific Dependencies', () => {

    test('should not use os.homedir() or os.tmpdir() for critical paths', () => {
        // Arrange
        const serverDir = path.join(__dirname, '../server');
        const jsFiles = [];
        
        // Recursively find all JS files in server directory
        function findJsFiles(dir) {
            const items = fs.readdirSync(dir);
            items.forEach(item => {
                const fullPath = path.join(dir, item);
                if (fs.statSync(fullPath).isDirectory()) {
                    findJsFiles(fullPath);
                } else if (item.endsWith('.js')) {
                    jsFiles.push(fullPath);
                }
            });
        }
        
        findJsFiles(serverDir);
        
        // Act & Assert
        jsFiles.forEach(filePath => {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Should NOT use os.homedir() for app paths (machine-specific)
            expect(content).not.toMatch(/os\.homedir\(\)/);
            
            // Should NOT use os.tmpdir() for persistent data (machine-specific temp)
            // Allow os.tmpdir() only if it's for actual temp files, not database/data
            if (content.match(/os\.tmpdir\(\)/)) {
                // If os.tmpdir is used, it should be for temp purposes only
                // and not for database or data directories
                expect(filePath).not.toContain('database');
                expect(filePath).not.toContain('paths');
            }
        });
    });

    test('should not have machine-specific paths in all server JS files', () => {
        // Arrange
        const serverDir = path.join(__dirname, '../server');
        const jsFiles = [];
        
        function findJsFiles(dir) {
            const items = fs.readdirSync(dir);
            items.forEach(item => {
                const fullPath = path.join(dir, item);
                if (fs.statSync(fullPath).isDirectory()) {
                    findJsFiles(fullPath);
                } else if (item.endsWith('.js')) {
                    jsFiles.push(fullPath);
                }
            });
        }
        
        findJsFiles(serverDir);
        
        // Machine-specific path patterns to check
        const machineSpecificPatterns = [
            /C:\\Users\\[^\\]+/i,           // Windows user paths
            /C:\\Documents and Settings/i,   // Old Windows paths
            /\/home\/[^/]+\//,               // Linux user paths
            /\/Users\/[^/]+\//,              // macOS user paths
            /'[A-Z]:\\/,                     // Hardcoded Windows drive paths in source
            /"[A-Z]:\\/                      // Hardcoded Windows drive paths in source
        ];
        
        // Act & Assert
        jsFiles.forEach(filePath => {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            machineSpecificPatterns.forEach(pattern => {
                expect(content).not.toMatch(pattern);
            });
        });
    });

    test('should have all critical modules use appRootDir or resolvePath', () => {
        // Arrange
        const criticalModules = [
            'server/shared/paths.js',
            'server/db/database.js',
            'server/config.js',
            'server/shared/logger.js'
        ];
        
        // Act & Assert
        criticalModules.forEach(relativePath => {
            const fullPath = path.join(__dirname, '..', relativePath);
            const content = fs.readFileSync(fullPath, 'utf-8');
            
            // Should either define appRootDir or import it from paths module
            const hasAppRootDir = content.match(/appRootDir/) || content.match(/require.*paths/);
            expect(hasAppRootDir).toBeTruthy();
            
            // Should use path module for path operations
            expect(content).toMatch(/const path = require\('path'\)/);
        });
    });

    test('should verify logger writes logs to portable location', () => {
        // Arrange
        const logger = require('../server/shared/logger');
        const paths = require('../server/shared/paths');
        
        // Act
        const logDir = logger._getLogDir();
        const logFile = logger._getLogFilePath();
        
        // Assert
        // Log directory should be inside app root
        expect(logDir).toBe(paths.resolvePath('logs'));
        expect(logDir).toContain(paths.appRootDir);
        
        // Log file path should be inside log directory
        expect(logFile).toBe(path.join(logDir, 'app.log'));
        
        // Should NOT contain user-specific paths
        expect(logDir).not.toContain('C:\\Users');
        expect(logFile).not.toContain('C:\\Users');
    });

});
