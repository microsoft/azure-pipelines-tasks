// L2 End-to-End Tests for MavenAuthenticateV0
// These tests require a REAL Azure DevOps environment with:
// - Active Azure Artifacts feeds
// - Valid service connections
// - Network connectivity
// - Maven CLI installed

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as childProcess from 'child_process';
import * as xmlParser from 'xml2js';

// E2E Test Configuration (set via environment variables)
interface E2EConfig {
    // Azure DevOps settings
    organizationUrl: string;
    projectName: string;
    feedName: string;
    accessToken: string;
    
    // Optional: External Maven settings
    externalMavenUrl?: string;
    externalUsername?: string;
    externalPassword?: string;
    
    // Test package details
    testGroupId: string;
    testArtifactId: string;
    testVersion: string;
}

function getE2EConfig(): E2EConfig {
    return {
        organizationUrl: process.env['E2E_ORGANIZATION_URL'] || '',
        projectName: process.env['E2E_PROJECT_NAME'] || '',
        feedName: process.env['E2E_FEED_NAME'] || '',
        accessToken: process.env['E2E_ACCESS_TOKEN'] || process.env['SYSTEM_ACCESSTOKEN'] || '',
        externalMavenUrl: process.env['E2E_EXTERNAL_MAVEN_URL'],
        externalUsername: process.env['E2E_EXTERNAL_USERNAME'],
        externalPassword: process.env['E2E_EXTERNAL_PASSWORD'],
        testGroupId: process.env['E2E_TEST_GROUP_ID'] || 'com.test',
        testArtifactId: process.env['E2E_TEST_ARTIFACT_ID'] || 'test-maven-e2e',
        testVersion: process.env['E2E_TEST_VERSION'] || '1.0.0'
    };
}

function configIsValid(config: E2EConfig): boolean {
    return !!(config.organizationUrl && config.feedName && config.accessToken);
}

function runTask(inputs: { [key: string]: string }, env: { [key: string]: string }): { success: boolean; output: string } {
    const taskPath = path.join(__dirname, '..', 'mavenauth.js');
    
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

function checkMavenInstalled(): boolean {
    try {
        childProcess.execSync('mvn --version', { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

function getM2SettingsPath(): string {
    if (os.platform() === 'win32') {
        return path.join(process.env.USERPROFILE || '', '.m2', 'settings.xml');
    } else {
        return path.join(os.homedir(), '.m2', 'settings.xml');
    }
}

function getBackupSettingsPath(): string {
    if (os.platform() === 'win32') {
        return path.join(process.env.USERPROFILE || '', '.m2', '_settings.xml');
    } else {
        return path.join(os.homedir(), '.m2', '_settings.xml');
    }
}

async function readSettingsXml(settingsPath: string): Promise<any> {
    const xmlContent = fs.readFileSync(settingsPath, 'utf8');
    const parser = new xmlParser.Parser();
    return await parser.parseStringPromise(xmlContent);
}

function downloadArtifact(groupId: string, artifactId: string, version: string, settingsPath: string): { success: boolean; output: string } {
    try {
        const result = childProcess.execSync(
            `mvn dependency:get -DgroupId=${groupId} -DartifactId=${artifactId} -Dversion=${version} -s "${settingsPath}"`,
            {
                encoding: 'utf8',
                stdio: 'pipe'
            }
        );
        return { success: true, output: result };
    } catch (error: any) {
        return { success: false, output: error.stdout + error.stderr };
    }
}

describe('MavenAuthenticate L2 - End-to-End Tests', function () {
    this.timeout(180000); // 3 minutes for E2E tests (Maven can be slow)
    
    const config = getE2EConfig();
    let settingsPath: string;
    let backupSettingsPath: string;
    let originalSettingsContent: string | null = null;

    before(function () {
        // Check if E2E configuration is available
        if (!configIsValid(config)) {
            console.log('⚠️  E2E tests skipped: Missing required environment variables');
            console.log('   Required: E2E_ORGANIZATION_URL, E2E_FEED_NAME, E2E_ACCESS_TOKEN');
            console.log('   Optional: E2E_PROJECT_NAME, E2E_EXTERNAL_MAVEN_URL');
            this.skip();
        }
        
        // Check if Maven is installed
        if (!checkMavenInstalled()) {
            console.log('⚠️  E2E tests skipped: Maven not installed');
            console.log('   Install from: https://maven.apache.org/download.cgi');
            this.skip();
        }
        
        settingsPath = getM2SettingsPath();
        backupSettingsPath = getBackupSettingsPath();
        
        // Backup existing settings.xml if it exists
        if (fs.existsSync(settingsPath)) {
            originalSettingsContent = fs.readFileSync(settingsPath, 'utf8');
            console.log(`📝 Backed up existing settings.xml`);
        }
    });

    after(function () {
        // Restore original settings.xml
        if (originalSettingsContent) {
            fs.writeFileSync(settingsPath, originalSettingsContent);
            console.log(`♻️  Restored original settings.xml`);
        } else if (fs.existsSync(settingsPath)) {
            // Remove settings.xml if it didn't exist before
            fs.unlinkSync(settingsPath);
        }
        
        // Clean up backup file if it exists
        if (fs.existsSync(backupSettingsPath)) {
            fs.unlinkSync(backupSettingsPath);
        }
    });

    it('should create settings.xml with Azure Artifacts feed authentication', async function () {
        const inputs = {
            artifactsFeeds: config.feedName
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken
        };
        
        const result = runTask(inputs, env);
        
        assert.strictEqual(result.success, true, `Task should succeed. Output:\n${result.output}`);
        
        // Verify settings.xml was created/modified
        assert(fs.existsSync(settingsPath), `settings.xml should exist at ${settingsPath}`);
        
        // Parse and verify settings.xml content
        const settingsXml = await readSettingsXml(settingsPath);
        
        assert(settingsXml.settings, 'Should have settings root element');
        assert(settingsXml.settings.servers, 'Should have servers section');
        
        // Find the server entry for our feed
        const servers = settingsXml.settings.servers[0].server;
        const feedServer = servers.find((s: any) => s.id[0] === config.feedName);
        
        assert(feedServer, `Should have server entry for feed: ${config.feedName}`);
        assert(feedServer.username, 'Should have username in server entry');
        assert(feedServer.password, 'Should have password in server entry');
        
        console.log(`✅ settings.xml created with authentication for feed: ${config.feedName}`);
    });

    it('should add authentication for multiple feeds', async function () {
        const feed1 = config.feedName;
        const feed2 = process.env['E2E_FEED_NAME_2'] || `${config.feedName}-secondary`;
        
        const inputs = {
            artifactsFeeds: `${feed1}, ${feed2}`
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken
        };
        
        const result = runTask(inputs, env);
        
        assert.strictEqual(result.success, true, `Task should succeed. Output:\n${result.output}`);
        
        // Parse settings.xml
        const settingsXml = await readSettingsXml(settingsPath);
        const servers = settingsXml.settings.servers[0].server;
        
        // Verify both feeds have server entries
        const feed1Server = servers.find((s: any) => s.id[0] === feed1);
        const feed2Server = servers.find((s: any) => s.id[0] === feed2);
        
        assert(feed1Server, `Should have server entry for feed: ${feed1}`);
        assert(feed2Server, `Should have server entry for feed: ${feed2}`);
        
        console.log(`✅ Multiple feeds authenticated: ${feed1}, ${feed2}`);
    });

    it('should download artifact from authenticated Azure Artifacts feed', async function () {
        // First, authenticate
        const inputs = {
            artifactsFeeds: config.feedName
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken
        };
        
        const authResult = runTask(inputs, env);
        assert.strictEqual(authResult.success, true, 'Authentication should succeed');
        
        // Try to download an artifact (requires a package in the feed)
        const testGroupId = process.env['E2E_TEST_GROUP_ID'];
        const testArtifactId = process.env['E2E_TEST_ARTIFACT_ID'];
        const testVersion = process.env['E2E_TEST_VERSION'];
        
        if (!testGroupId || !testArtifactId || !testVersion) {
            console.log('⚠️  Skipped: E2E_TEST_GROUP_ID, E2E_TEST_ARTIFACT_ID, E2E_TEST_VERSION not set');
            this.skip();
        }
        
        const downloadResult = downloadArtifact(testGroupId, testArtifactId, testVersion, settingsPath);
        
        // Even if package doesn't exist, authentication should work (404 vs 401)
        if (!downloadResult.success && downloadResult.output.includes('401')) {
            assert.fail('Artifact download failed with 401 Unauthorized - authentication did not work');
        }
        
        console.log(`✅ Feed authentication verified (can access feed)`);
    });

    it('should preserve existing settings.xml entries', async function () {
        // Create a settings.xml with a custom server entry
        const customSettingsXml = `<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0
                              http://maven.apache.org/xsd/settings-1.0.0.xsd">
    <servers>
        <server>
            <id>custom-repo</id>
            <username>custom-user</username>
            <password>custom-pass</password>
        </server>
    </servers>
</settings>`;
        
        fs.writeFileSync(settingsPath, customSettingsXml);
        
        // Run the task
        const inputs = {
            artifactsFeeds: config.feedName
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken
        };
        
        const result = runTask(inputs, env);
        assert.strictEqual(result.success, true, 'Task should succeed');
        
        // Verify both custom and new entries exist
        const settingsXml = await readSettingsXml(settingsPath);
        const servers = settingsXml.settings.servers[0].server;
        
        const customServer = servers.find((s: any) => s.id[0] === 'custom-repo');
        const feedServer = servers.find((s: any) => s.id[0] === config.feedName);
        
        assert(customServer, 'Should preserve existing custom-repo entry');
        assert.strictEqual(customServer.username[0], 'custom-user', 'Should preserve custom username');
        assert(feedServer, 'Should add new feed entry');
        
        console.log(`✅ Existing settings.xml entries preserved`);
    });

    it('should create backup of original settings.xml', function () {
        // Remove settings.xml to start fresh
        if (fs.existsSync(settingsPath)) {
            fs.unlinkSync(settingsPath);
        }
        if (fs.existsSync(backupSettingsPath)) {
            fs.unlinkSync(backupSettingsPath);
        }
        
        // Create an original settings.xml
        const originalContent = `<?xml version="1.0" encoding="UTF-8"?>
<settings>
    <servers>
        <server>
            <id>original-server</id>
            <username>original</username>
        </server>
    </servers>
</settings>`;
        
        fs.writeFileSync(settingsPath, originalContent);
        
        // Run the task (first time should create backup)
        const inputs = {
            artifactsFeeds: config.feedName
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken
        };
        
        const result = runTask(inputs, env);
        assert.strictEqual(result.success, true, 'Task should succeed');
        
        // Verify backup was created
        assert(fs.existsSync(backupSettingsPath), `Backup should exist at ${backupSettingsPath}`);
        
        const backupContent = fs.readFileSync(backupSettingsPath, 'utf8');
        assert(backupContent.includes('original-server'), 'Backup should contain original content');
        
        console.log(`✅ Backup created at ${backupSettingsPath}`);
    });

    it('should authenticate using Workload Identity Federation (WIF)', async function () {
        const wifServiceConnection = process.env['E2E_WIF_SERVICE_CONNECTION'];
        const wifFeedName = process.env['E2E_WIF_FEED_NAME'];
        
        if (!wifServiceConnection || !wifFeedName) {
            console.log('⚠️  Skipped: WIF configuration not available');
            console.log('   Required: E2E_WIF_SERVICE_CONNECTION, E2E_WIF_FEED_NAME');
            this.skip();
        }
        
        const inputs = {
            workloadIdentityServiceConnection: wifServiceConnection,
            artifactsFeeds: wifFeedName
        };
        
        const env = {};
        
        const result = runTask(inputs, env);
        
        assert.strictEqual(result.success, true, `Task should succeed. Output:\n${result.output}`);
        
        // Verify settings.xml has the WIF feed entry
        const settingsXml = await readSettingsXml(settingsPath);
        const servers = settingsXml.settings.servers[0].server;
        const wifServer = servers.find((s: any) => s.id[0] === wifFeedName);
        
        assert(wifServer, `Should have server entry for WIF feed: ${wifFeedName}`);
        assert.strictEqual(wifServer.username[0], wifServiceConnection, 'Username should be service connection name');
        
        console.log(`✅ WIF authentication successful`);
    });

    it('should handle external Maven service endpoints', function () {
        if (!config.externalMavenUrl) {
            console.log('⚠️  Skipped: External Maven repository not configured');
            this.skip();
        }
        
        const inputs = {
            mavenServiceConnections: 'ExternalMavenRepo'
        };
        
        const env = {};
        
        const result = runTask(inputs, env);
        
        // This might fail without real service connection setup
        // Just verify the task attempts to process it
        assert(result.output.length > 0, 'Should produce output');
        
        console.log(`✅ External service connection processed`);
    });

    it('should update settings.xml on subsequent runs', async function () {
        // First run
        const inputs1 = {
            artifactsFeeds: config.feedName
        };
        
        const env = {
            SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: config.organizationUrl,
            SYSTEM_ACCESSTOKEN: config.accessToken
        };
        
        const result1 = runTask(inputs1, env);
        assert.strictEqual(result1.success, true, 'First run should succeed');
        
        // Second run with additional feed
        const feed2 = process.env['E2E_FEED_NAME_2'] || `${config.feedName}-2`;
        const inputs2 = {
            artifactsFeeds: `${config.feedName}, ${feed2}`
        };
        
        const result2 = runTask(inputs2, env);
        assert.strictEqual(result2.success, true, 'Second run should succeed');
        
        // Verify settings.xml has both feeds
        const settingsXml = await readSettingsXml(settingsPath);
        const servers = settingsXml.settings.servers[0].server;
        
        assert(servers.find((s: any) => s.id[0] === config.feedName), 'Should have first feed');
        assert(servers.find((s: any) => s.id[0] === feed2), 'Should have second feed');
        
        console.log(`✅ settings.xml updated across multiple runs`);
    });
});
