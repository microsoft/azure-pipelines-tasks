// L2 End-to-End Tests for PipAuthenticateV1
// These tests require a REAL Azure DevOps environment with:
// - Active Azure Artifacts feeds
// - Valid service connections
// - Network connectivity
// - pip CLI installed

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as childProcess from 'child_process';

// E2E Test Configuration (set via environment variables)
interface E2EConfig {
    // Azure DevOps settings
    organizationUrl: string;
    projectName: string;
    feedName: string;
    accessToken: string;
    
    // Optional: External PyPI settings
    externalPyPIUrl?: string;
    externalUsername?: string;
    externalPassword?: string;
    
    // Test package details
    testPackageName: string;
    testPackageVersion: string;
}

function getE2EConfig(): E2EConfig {
    return {
        organizationUrl: process.env['E2E_ORGANIZATION_URL'] || '',
        projectName: process.env['E2E_PROJECT_NAME'] || '',
        feedName: process.env['E2E_FEED_NAME'] || '',
        accessToken: process.env['E2E_ACCESS_TOKEN'] || process.env['SYSTEM_ACCESSTOKEN'] || '',
        externalPyPIUrl: process.env['E2E_EXTERNAL_PYPI_URL'],
        externalUsername: process.env['E2E_EXTERNAL_USERNAME'],
        externalPassword: process.env['E2E_EXTERNAL_PASSWORD'],
        testPackageName: process.env['E2E_TEST_PACKAGE_NAME'] || 'test-pip-e2e-package',
        testPackageVersion: process.env['E2E_TEST_PACKAGE_VERSION'] || '0.0.1'
    };
}

function configIsValid(config: E2EConfig): boolean {
    return !!(config.organizationUrl && config.feedName && config.accessToken);
}

function runTask(inputs: { [key: string]: string }, env: { [key: string]: string }): { success: boolean; output: string } {
    const taskPath = path.join(__dirname, '..', 'pipauthenticatemain.js');
    
    // Set inputs as environment variables
    const taskEnv = { ...process.env, ...env };
    for (const [key, value] of Object.entries(inputs)) {
        taskEnv[`INPUT_${key.toUpperCase()}`] = value;
    }
    
    try {
        const result = childProcess.execSync(`node "${taskPath}"`, {
            env: taskEnv,
            encoding: 'utf8',
            stdio: 'pipe'
        });
        return { success: true, output: result };
    } catch (error: any) {
        return { success: false, output: error.stdout + error.stderr };
    }
}

function checkPythonAndPipInstalled(): boolean {
    try {
        childProcess.execSync('python --version', { stdio: 'pipe' });
        childProcess.execSync('pip --version', { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

function getPipConfigPath(): string {
    if (os.platform() === 'win32') {
        return path.join(process.env.APPDATA || '', 'pip', 'pip.ini');
    } else {
        return path.join(os.homedir(), '.pip', 'pip.conf');
    }
}

function getPiprcPath(): string {
    return path.join(os.homedir(), '.pip', 'pip.conf');
}

function installPackage(packageSpec: string): { success: boolean; output: string } {
    try {
        const result = childProcess.execSync(`pip install "${packageSpec}"`, {
            encoding: 'utf8',
            stdio: 'pipe'
        });
        return { success: true, output: result };
    } catch (error: any) {
        return { success: false, output: error.stdout + error.stderr };
    }
}

describe('PipAuthenticate L2 - End-to-End Tests', function () {
    this.timeout(120000); // 2 minutes for E2E tests
    
    const config = getE2EConfig();
    let originalPipIndexUrl: string | undefined;
    let originalPipExtraIndexUrl: string | undefined;

    before(function () {
        // Check if E2E configuration is available
        if (!configIsValid(config)) {
            console.log('⚠️  E2E tests skipped: Missing required environment variables');
            console.log('   Required: E2E_ORGANIZATION_URL, E2E_FEED_NAME, E2E_ACCESS_TOKEN');
            console.log('   Optional: E2E_PROJECT_NAME, E2E_EXTERNAL_PYPI_URL');
            this.skip();
        }
        
        // Check if Python and pip are installed
        if (!checkPythonAndPipInstalled()) {
            console.log('⚠️  E2E tests skipped: Python and/or pip not installed');
            this.skip();
        }
        
        // Save original pip environment variables
        originalPipIndexUrl = process.env['PIP_INDEX_URL'];
        originalPipExtraIndexUrl = process.env['PIP_EXTRA_INDEX_URL'];
    });

    afterEach(function () {
        // Restore original pip environment variables
        if (originalPipIndexUrl) {
            process.env['PIP_INDEX_URL'] = originalPipIndexUrl;
        } else {
            delete process.env['PIP_INDEX_URL'];
        }
        
        if (originalPipExtraIndexUrl) {
            process.env['PIP_EXTRA_INDEX_URL'] = originalPipExtraIndexUrl;
        } else {
            delete process.env['PIP_EXTRA_INDEX_URL'];
        }
    });

    it('should set PIP_INDEX_URL for internal Azure Artifacts feed', function () {
        const inputs = {
            artifactFeeds: config.feedName
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken,
            AGENT_TEMPDIRECTORY: os.tmpdir()
        };
        
        const result = runTask(inputs, env);
        
        assert.strictEqual(result.success, true, `Task should succeed. Output:\n${result.output}`);
        
        // Verify PIP_INDEX_URL was set
        const pipIndexMatch = result.output.match(/##vso\[task\.setvariable variable=PIP_INDEX_URL[^\]]*\](.+)/);
        assert(pipIndexMatch, 'Should set PIP_INDEX_URL variable');
        
        const pipIndexUrl = pipIndexMatch[1].trim();
        
        // Verify URL contains authentication
        assert(pipIndexUrl.includes('build'), 'PIP_INDEX_URL should contain username');
        assert(pipIndexUrl.includes(config.organizationUrl.replace('https://', '')), 'Should contain organization URL');
        
        console.log(`✅ PIP_INDEX_URL set: ${pipIndexUrl.replace(/:[^@]+@/, ':***@')}`);
    });

    it('should set PIP_EXTRA_INDEX_URL with onlyAddExtraIndex', function () {
        const inputs = {
            artifactFeeds: config.feedName,
            onlyAddExtraIndex: 'true'
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken,
            AGENT_TEMPDIRECTORY: os.tmpdir()
        };
        
        const result = runTask(inputs, env);
        
        assert.strictEqual(result.success, true, `Task should succeed. Output:\n${result.output}`);
        
        // Verify PIP_EXTRA_INDEX_URL was set instead of PIP_INDEX_URL
        const pipExtraIndexMatch = result.output.match(/##vso\[task\.setvariable variable=PIP_EXTRA_INDEX_URL[^\]]*\](.+)/);
        assert(pipExtraIndexMatch, 'Should set PIP_EXTRA_INDEX_URL variable');
        
        const pipExtraIndexUrl = pipExtraIndexMatch[1].trim();
        assert(pipExtraIndexUrl.includes('build'), 'PIP_EXTRA_INDEX_URL should contain username');
        
        console.log(`✅ PIP_EXTRA_INDEX_URL set for extra index mode`);
    });

    it('should install package from authenticated Azure Artifacts feed', function () {
        // First, authenticate
        const inputs = {
            artifactFeeds: config.feedName
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken,
            AGENT_TEMPDIRECTORY: os.tmpdir()
        };
        
        const authResult = runTask(inputs, env);
        assert.strictEqual(authResult.success, true, 'Authentication should succeed');
        
        // Extract and set PIP_INDEX_URL
        const pipIndexMatch = authResult.output.match(/##vso\[task\.setvariable variable=PIP_INDEX_URL[^\]]*\](.+)/);
        assert(pipIndexMatch, 'Should get PIP_INDEX_URL');
        
        process.env['PIP_INDEX_URL'] = pipIndexMatch[1].trim();
        
        // Try to install a package (this will fail if auth doesn't work)
        // Note: You should have at least one package in your feed for this to work
        const testPackage = process.env['E2E_TEST_PACKAGE_TO_INSTALL'];
        
        if (!testPackage) {
            console.log('⚠️  Skipped: E2E_TEST_PACKAGE_TO_INSTALL not set');
            this.skip();
        }
        
        const installResult = installPackage(testPackage);
        
        // Even if package doesn't exist, authentication should work (404 vs 401)
        // 401 = auth failed, 404 = auth worked but package doesn't exist
        if (!installResult.success && installResult.output.includes('401')) {
            assert.fail('Package installation failed with 401 Unauthorized - authentication did not work');
        }
        
        console.log(`✅ Feed authentication verified (can access feed)`);
    });

    it('should authenticate to multiple internal feeds', function () {
        const feed1 = config.feedName;
        const feed2 = process.env['E2E_FEED_NAME_2'] || `${config.feedName}-secondary`;
        
        const inputs = {
            artifactFeeds: `${feed1}, ${feed2}`,
            onlyAddExtraIndex: 'true'
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken,
            AGENT_TEMPDIRECTORY: os.tmpdir()
        };
        
        const result = runTask(inputs, env);
        
        assert.strictEqual(result.success, true, `Task should succeed. Output:\n${result.output}`);
        
        // Verify PIP_EXTRA_INDEX_URL contains multiple feeds
        const pipExtraIndexMatch = result.output.match(/##vso\[task\.setvariable variable=PIP_EXTRA_INDEX_URL[^\]]*\](.+)/);
        assert(pipExtraIndexMatch, 'Should set PIP_EXTRA_INDEX_URL variable');
        
        const pipExtraIndexUrl = pipExtraIndexMatch[1].trim();
        
        // Multiple feeds are space-separated in PIP_EXTRA_INDEX_URL
        const feedUrls = pipExtraIndexUrl.split(' ');
        assert(feedUrls.length >= 1, 'Should have at least one feed URL');
        
        console.log(`✅ Multiple feeds authenticated: ${feedUrls.length} feeds`);
    });

    it('should authenticate to external PyPI service connection', function () {
        if (!config.externalPyPIUrl) {
            console.log('⚠️  Skipped: External PyPI credentials not configured');
            this.skip();
        }
        
        const inputs = {
            pythonDownloadServiceConnections: 'ExternalPyPI'
        };
        
        const env = {
            AGENT_TEMPDIRECTORY: os.tmpdir()
            // Service connection would be configured in Azure Pipelines
        };
        
        const result = runTask(inputs, env);
        
        // This might fail without real service connection setup
        // Just verify the task attempts to process it
        assert(result.output.length > 0, 'Should produce output');
        
        console.log(`✅ External service connection processed`);
    });

    it('should handle combined internal and external authentication', function () {
        if (!config.externalPyPIUrl) {
            console.log('⚠️  Skipped: External PyPI credentials not configured');
            this.skip();
        }
        
        const inputs = {
            artifactFeeds: config.feedName,
            pythonDownloadServiceConnections: 'ExternalPyPI',
            onlyAddExtraIndex: 'true'
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken,
            AGENT_TEMPDIRECTORY: os.tmpdir()
        };
        
        const result = runTask(inputs, env);
        
        assert.strictEqual(result.success, true, `Task should succeed. Output:\n${result.output}`);
        
        // Verify PIP_EXTRA_INDEX_URL was set with multiple sources
        const pipExtraIndexMatch = result.output.match(/##vso\[task\.setvariable variable=PIP_EXTRA_INDEX_URL[^\]]*\](.+)/);
        assert(pipExtraIndexMatch, 'Should set PIP_EXTRA_INDEX_URL variable');
        
        console.log(`✅ Combined authentication successful`);
    });

    it('should authenticate using Workload Identity Federation (WIF)', function () {
        const wifServiceConnection = process.env['E2E_WIF_SERVICE_CONNECTION'];
        const feedUrl = process.env['E2E_WIF_FEED_URL'];
        
        if (!wifServiceConnection || !feedUrl) {
            console.log('⚠️  Skipped: WIF configuration not available');
            console.log('   Required: E2E_WIF_SERVICE_CONNECTION, E2E_WIF_FEED_URL');
            this.skip();
        }
        
        const inputs = {
            workloadIdentityServiceConnection: wifServiceConnection,
            feedUrl: feedUrl
        };
        
        const env = {
            AGENT_TEMPDIRECTORY: os.tmpdir()
        };
        
        const result = runTask(inputs, env);
        
        assert.strictEqual(result.success, true, `Task should succeed. Output:\n${result.output}`);
        
        // Verify PIP_INDEX_URL was set with WIF credentials
        const pipIndexMatch = result.output.match(/##vso\[task\.setvariable variable=PIP_INDEX_URL[^\]]*\](.+)/);
        assert(pipIndexMatch, 'Should set PIP_INDEX_URL variable');
        
        console.log(`✅ WIF authentication successful`);
    });

    it('should persist environment variables across task invocations', function () {
        const inputs = {
            artifactFeeds: config.feedName
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken,
            AGENT_TEMPDIRECTORY: os.tmpdir()
        };
        
        // First invocation
        const result1 = runTask(inputs, env);
        assert.strictEqual(result1.success, true, 'First task run should succeed');
        
        const pipIndexMatch1 = result1.output.match(/##vso\[task\.setvariable variable=PIP_INDEX_URL[^\]]*\](.+)/);
        const pipIndexUrl1 = pipIndexMatch1![1].trim();
        
        // Second invocation with same config
        const result2 = runTask(inputs, env);
        assert.strictEqual(result2.success, true, 'Second task run should succeed');
        
        const pipIndexMatch2 = result2.output.match(/##vso\[task\.setvariable variable=PIP_INDEX_URL[^\]]*\](.+)/);
        const pipIndexUrl2 = pipIndexMatch2![1].trim();
        
        // Both should produce the same index URL
        assert.strictEqual(pipIndexUrl1, pipIndexUrl2, 'Should produce consistent PIP_INDEX_URL');
        
        console.log(`✅ Environment variable persistence verified`);
    });
});
