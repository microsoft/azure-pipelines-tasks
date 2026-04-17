// L2 End-to-End Tests for TwineAuthenticateV1
// These tests require a REAL Azure DevOps environment with:
// - Active Azure Artifacts feeds
// - Valid service connections
// - Network connectivity
// - Twine CLI installed

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
    testPackagePath: string;
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
        testPackageName: process.env['E2E_TEST_PACKAGE_NAME'] || 'test-twine-e2e-package',
        testPackageVersion: process.env['E2E_TEST_PACKAGE_VERSION'] || '0.0.1',
        testPackagePath: process.env['E2E_TEST_PACKAGE_PATH'] || path.join(__dirname, 'test-package')
    };
}

function configIsValid(config: E2EConfig): boolean {
    return !!(config.organizationUrl && config.feedName && config.accessToken);
}

function runTask(inputs: { [key: string]: string }, env: { [key: string]: string }): { success: boolean; output: string } {
    const taskPath = path.join(__dirname, '..', 'twineauthenticatemain.js');
    
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

function createTestPythonPackage(packagePath: string, packageName: string, version: string): void {
    // Create package directory structure
    const srcDir = path.join(packagePath, packageName.replace(/-/g, '_'));
    fs.mkdirSync(srcDir, { recursive: true });
    
    // Create setup.py
    const setupPy = `
from setuptools import setup, find_packages

setup(
    name="${packageName}",
    version="${version}",
    packages=find_packages(),
    description="Test package for TwineAuthenticateV1 E2E tests",
    author="Azure Pipelines Tasks",
    author_email="test@example.com",
    python_requires=">=3.6",
)
`.trim();
    
    fs.writeFileSync(path.join(packagePath, 'setup.py'), setupPy);
    
    // Create __init__.py
    const initPy = `
"""Test package for E2E testing."""
__version__ = "${version}"

def hello():
    return "Hello from ${packageName} ${version}"
`.trim();
    
    fs.writeFileSync(path.join(srcDir, '__init__.py'), initPy);
    
    // Create README.md
    const readme = `# ${packageName}\n\nTest package for TwineAuthenticateV1 E2E tests.\nVersion: ${version}\n`;
    fs.writeFileSync(path.join(packagePath, 'README.md'), readme);
}

function buildPythonPackage(packagePath: string): string {
    // Build the package
    childProcess.execSync('python setup.py sdist bdist_wheel', {
        cwd: packagePath,
        stdio: 'inherit'
    });
    
    // Return path to dist directory
    return path.join(packagePath, 'dist');
}

function publishWithTwine(distPath: string, pypircPath: string): { success: boolean; output: string } {
    try {
        const result = childProcess.execSync(`twine upload --config-file "${pypircPath}" "${distPath}/*"`, {
            encoding: 'utf8',
            stdio: 'pipe',
            env: { ...process.env, PYPIRC_PATH: pypircPath }
        });
        return { success: true, output: result };
    } catch (error: any) {
        return { success: false, output: error.stdout + error.stderr };
    }
}

function checkPythonAndTwineInstalled(): boolean {
    try {
        childProcess.execSync('python --version', { stdio: 'pipe' });
        childProcess.execSync('twine --version', { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

describe('TwineAuthenticate L2 - End-to-End Tests', function () {
    this.timeout(120000); // 2 minutes for E2E tests
    
    const config = getE2EConfig();
    let testPackagePath: string;
    let pypircPath: string;

    before(function () {
        // Check if E2E configuration is available
        if (!configIsValid(config)) {
            console.log('⚠️  E2E tests skipped: Missing required environment variables');
            console.log('   Required: E2E_ORGANIZATION_URL, E2E_FEED_NAME, E2E_ACCESS_TOKEN');
            console.log('   Optional: E2E_PROJECT_NAME, E2E_EXTERNAL_PYPI_URL');
            this.skip();
        }
        
        // Check if Python and Twine are installed
        if (!checkPythonAndTwineInstalled()) {
            console.log('⚠️  E2E tests skipped: Python and/or Twine not installed');
            console.log('   Install with: pip install twine');
            this.skip();
        }
        
        // Create test package directory
        testPackagePath = fs.mkdtempSync(path.join(os.tmpdir(), 'twine-e2e-'));
        console.log(`📦 Test package directory: ${testPackagePath}`);
    });

    after(function () {
        // Cleanup test package directory
        if (testPackagePath && fs.existsSync(testPackagePath)) {
            fs.rmSync(testPackagePath, { recursive: true, force: true });
        }
        
        // Cleanup .pypirc file
        if (pypircPath && fs.existsSync(pypircPath)) {
            fs.unlinkSync(pypircPath);
        }
    });

    it('should authenticate to internal Azure Artifacts feed', function () {
        const inputs = {
            artifactFeed: config.feedName
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken,
            AGENT_TEMPDIRECTORY: os.tmpdir()
        };
        
        const result = runTask(inputs, env);
        
        assert.strictEqual(result.success, true, `Task should succeed. Output:\n${result.output}`);
        
        // Verify PYPIRC_PATH was set
        const pypircMatch = result.output.match(/##vso\[task\.setvariable variable=PYPIRC_PATH[^\]]*\](.+)/);
        assert(pypircMatch, 'Should set PYPIRC_PATH variable');
        
        pypircPath = pypircMatch[1].trim();
        
        // Verify .pypirc file exists
        assert(fs.existsSync(pypircPath), `.pypirc file should exist at ${pypircPath}`);
        
        // Verify .pypirc content
        const content = fs.readFileSync(pypircPath, 'utf8');
        assert(content.includes('[distutils]'), 'Should have distutils section');
        assert(content.includes(config.feedName), 'Should contain feed name');
        assert(content.includes('repository='), 'Should have repository URL');
        
        console.log(`✅ .pypirc created successfully at ${pypircPath}`);
    });

    it('should publish package to Azure Artifacts feed using authenticated .pypirc', function () {
        // This test depends on the previous test
        if (!pypircPath || !fs.existsSync(pypircPath)) {
            this.skip();
        }
        
        // Create test package
        const packageName = `${config.testPackageName}-${Date.now()}`;
        const version = config.testPackageVersion;
        
        createTestPythonPackage(testPackagePath, packageName, version);
        console.log(`📦 Created test package: ${packageName} v${version}`);
        
        // Build package
        const distPath = buildPythonPackage(testPackagePath);
        console.log(`🔨 Built package at: ${distPath}`);
        
        // Publish with Twine
        const publishResult = publishWithTwine(distPath, pypircPath);
        
        assert(publishResult.success, `Twine upload should succeed. Output:\n${publishResult.output}`);
        assert(publishResult.output.includes('Uploading') || publishResult.output.includes('uploaded'), 
            'Should show upload progress');
        
        console.log(`✅ Package published successfully to ${config.feedName}`);
    });

    it('should authenticate to multiple internal feeds', function () {
        const feed1 = config.feedName;
        const feed2 = process.env['E2E_FEED_NAME_2'] || `${config.feedName}-secondary`;
        
        const inputs = {
            artifactFeed: `${feed1}, ${feed2}`
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken,
            AGENT_TEMPDIRECTORY: os.tmpdir()
        };
        
        const result = runTask(inputs, env);
        
        assert.strictEqual(result.success, true, `Task should succeed. Output:\n${result.output}`);
        
        // Get .pypirc path
        const pypircMatch = result.output.match(/##vso\[task\.setvariable variable=PYPIRC_PATH[^\]]*\](.+)/);
        assert(pypircMatch, 'Should set PYPIRC_PATH variable');
        
        const multiFeedPypircPath = pypircMatch[1].trim();
        const content = fs.readFileSync(multiFeedPypircPath, 'utf8');
        
        // Verify both feeds are configured
        assert(content.includes(feed1), 'Should contain first feed');
        assert(content.includes(feed2), 'Should contain second feed');
        
        // Verify index-servers lists both
        const indexMatch = content.match(/index-servers\s*=\s*(.+)/);
        assert(indexMatch, 'Should have index-servers');
        assert(indexMatch[1].includes(feed1), 'index-servers should list feed1');
        assert(indexMatch[1].includes(feed2), 'index-servers should list feed2');
        
        console.log(`✅ Multiple feeds authenticated: ${feed1}, ${feed2}`);
        
        // Cleanup
        fs.unlinkSync(multiFeedPypircPath);
    });

    it('should authenticate to external PyPI service connection', function () {
        if (!config.externalPyPIUrl || !config.externalUsername || !config.externalPassword) {
            console.log('⚠️  Skipped: External PyPI credentials not configured');
            this.skip();
        }
        
        const inputs = {
            pythonUploadServiceConnection: 'ExternalPyPI'
        };
        
        const env = {
            AGENT_TEMPDIRECTORY: os.tmpdir(),
            // Service connection would be configured in Azure Pipelines
        };
        
        const result = runTask(inputs, env);
        
        assert.strictEqual(result.success, true, `Task should succeed. Output:\n${result.output}`);
        
        const pypircMatch = result.output.match(/##vso\[task\.setvariable variable=PYPIRC_PATH[^\]]*\](.+)/);
        assert(pypircMatch, 'Should set PYPIRC_PATH variable');
        
        const externalPypircPath = pypircMatch[1].trim();
        const content = fs.readFileSync(externalPypircPath, 'utf8');
        
        assert(content.includes('ExternalPyPI'), 'Should contain external connection name');
        
        console.log(`✅ External PyPI authenticated`);
        
        // Cleanup
        fs.unlinkSync(externalPypircPath);
    });

    it('should handle combined internal and external authentication', function () {
        if (!config.externalPyPIUrl || !config.externalUsername || !config.externalPassword) {
            console.log('⚠️  Skipped: External PyPI credentials not configured');
            this.skip();
        }
        
        const inputs = {
            artifactFeed: config.feedName,
            pythonUploadServiceConnection: 'ExternalPyPI'
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken,
            AGENT_TEMPDIRECTORY: os.tmpdir()
        };
        
        const result = runTask(inputs, env);
        
        assert.strictEqual(result.success, true, `Task should succeed. Output:\n${result.output}`);
        
        const pypircMatch = result.output.match(/##vso\[task\.setvariable variable=PYPIRC_PATH[^\]]*\](.+)/);
        assert(pypircMatch, 'Should set PYPIRC_PATH variable');
        
        const combinedPypircPath = pypircMatch[1].trim();
        const content = fs.readFileSync(combinedPypircPath, 'utf8');
        
        // Verify both internal and external feeds
        assert(content.includes(config.feedName), 'Should contain internal feed');
        assert(content.includes('ExternalPyPI'), 'Should contain external connection');
        
        const indexMatch = content.match(/index-servers\s*=\s*(.+)/);
        assert(indexMatch, 'Should have index-servers');
        
        console.log(`✅ Combined authentication successful`);
        
        // Cleanup
        fs.unlinkSync(combinedPypircPath);
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
        
        const pypircMatch = result.output.match(/##vso\[task\.setvariable variable=PYPIRC_PATH[^\]]*\](.+)/);
        assert(pypircMatch, 'Should set PYPIRC_PATH variable');
        
        const wifPypircPath = pypircMatch[1].trim();
        assert(fs.existsSync(wifPypircPath), 'WIF .pypirc should exist');
        
        console.log(`✅ WIF authentication successful`);
        
        // Cleanup
        fs.unlinkSync(wifPypircPath);
    });

    it('should persist .pypirc across multiple task invocations', function () {
        const inputs = {
            artifactFeed: config.feedName
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken,
            AGENT_TEMPDIRECTORY: os.tmpdir()
        };
        
        // First invocation
        const result1 = runTask(inputs, env);
        assert.strictEqual(result1.success, true, 'First task run should succeed');
        
        const pypircMatch1 = result1.output.match(/##vso\[task\.setvariable variable=PYPIRC_PATH[^\]]*\](.+)/);
        const pypircPath1 = pypircMatch1![1].trim();
        
        // Set PYPIRC_PATH for second invocation
        env['PYPIRC_PATH'] = pypircPath1;
        
        // Second invocation - should reuse existing .pypirc
        const result2 = runTask(inputs, env);
        assert.strictEqual(result2.success, true, 'Second task run should succeed');
        
        const pypircMatch2 = result2.output.match(/##vso\[task\.setvariable variable=PYPIRC_PATH[^\]]*\](.+)/);
        const pypircPath2 = pypircMatch2![1].trim();
        
        // Should reuse the same file
        assert.strictEqual(pypircPath1, pypircPath2, 'Should reuse existing .pypirc path');
        
        console.log(`✅ .pypirc persistence verified`);
        
        // Cleanup
        fs.unlinkSync(pypircPath1);
    });
});
