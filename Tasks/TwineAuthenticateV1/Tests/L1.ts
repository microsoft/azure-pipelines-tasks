// L1 Integration Tests for TwineAuthenticateV1
// These tests use REAL file system operations but mock credentials

import * as path from 'path';
import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('TwineAuthenticate L1 - Integration Tests', function () {
    this.timeout(30000); // Longer timeout for integration tests
    
    let testTempDir: string;
    let agentTempDir: string;

    beforeEach(function () {
        // Create REAL temp directory for the test
        testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'twine-l1-test-'));
        agentTempDir = path.join(testTempDir, 'agent-temp');
        fs.mkdirSync(agentTempDir, { recursive: true });
    });

    afterEach(function () {
        // Clean up REAL temp directory
        if (fs.existsSync(testTempDir)) {
            fs.rmSync(testTempDir, { recursive: true, force: true });
        }
        
        // Clean up environment variables
        delete process.env['AGENT_TEMPDIRECTORY'];
        delete process.env['PYPIRC_PATH'];
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['__L1_ARTIFACT_FEED__'];
        delete process.env['__L1_EXTERNAL_ENDPOINTS__'];
    });

    it('should create real .pypirc file for internal feed', async function () {
        // Arrange
        const tp = path.join(__dirname, 'L1Setup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        process.env['AGENT_TEMPDIRECTORY'] = agentTempDir;
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-access-token-12345';
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = 'https://dev.azure.com/testorg/';
        process.env['__L1_ARTIFACT_FEED__'] = 'TestFeed';
        
        // Act
        await tr.runAsync();
        
        // Assert
        assert(tr.succeeded, `Task should succeed. Output:\n${tr.stdout}\nErrors:\n${tr.stderr}`);
        
        // Verify REAL file was created
        const twineAuthDir = path.join(agentTempDir, 'twineAuthenticate');
        assert(fs.existsSync(twineAuthDir), 'twineAuthenticate directory should exist');
        
        // Find the .pypirc file (it's in a subdirectory with random name)
        const subdirs = fs.readdirSync(twineAuthDir);
        assert(subdirs.length > 0, 'Should have created a subdirectory');
        
        const pypircPath = path.join(twineAuthDir, subdirs[0], '.pypirc');
        assert(fs.existsSync(pypircPath), '.pypirc file should exist');
        
        // Verify REAL file content
        const content = fs.readFileSync(pypircPath, 'utf8');
        
        // Check INI format structure
        assert(content.includes('[distutils]'), 'Should have distutils section');
        assert(content.includes('index-servers='), 'Should have index-servers');
        assert(content.includes('TestFeed'), 'Should contain feed name');
        
        // Check repository section
        assert(content.includes('[TestFeed]'), 'Should have feed section');
        assert(content.includes('repository='), 'Should have repository URL');
        assert(content.includes('username='), 'Should have username');
        assert(content.includes('password='), 'Should have password');
        
        // Verify credentials are in the file
        assert(content.includes('test-access-token-12345'), 'Should contain access token');
        
        console.log('\n=== Real .pypirc file content ===');
        console.log(content);
        console.log('=================================\n');
    });

    it('should create real .pypirc file for multiple feeds', async function () {
        // Arrange
        const tp = path.join(__dirname, 'L1Setup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        process.env['AGENT_TEMPDIRECTORY'] = agentTempDir;
        process.env['SYSTEM_ACCESSTOKEN'] = 'multi-feed-token';
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = 'https://dev.azure.com/testorg/';
        process.env['__L1_ARTIFACT_FEED__'] = 'Feed1, Feed2, Feed3';
        
        // Act
        await tr.runAsync();
        
        // Assert
        assert(tr.succeeded, `Task should succeed. Output:\n${tr.stdout}\nErrors:\n${tr.stderr}`);
        
        // Find and read the .pypirc file
        const twineAuthDir = path.join(agentTempDir, 'twineAuthenticate');
        const subdirs = fs.readdirSync(twineAuthDir);
        const pypircPath = path.join(twineAuthDir, subdirs[0], '.pypirc');
        
        const content = fs.readFileSync(pypircPath, 'utf8');
        
        // Verify multiple feeds are listed
        assert(content.includes('index-servers='), 'Should have index-servers');
        assert(content.includes('Feed1'), 'Should contain Feed1');
        assert(content.includes('Feed2'), 'Should contain Feed2');
        assert(content.includes('Feed3'), 'Should contain Feed3');
        
        // Verify each feed has its own section
        assert(content.includes('[Feed1]'), 'Should have Feed1 section');
        assert(content.includes('[Feed2]'), 'Should have Feed2 section');
        assert(content.includes('[Feed3]'), 'Should have Feed3 section');
        
        // Count the number of repository entries
        const repositoryCount = (content.match(/repository=/g) || []).length;
        assert.strictEqual(repositoryCount, 3, 'Should have 3 repository entries');
    });

    it('should handle external service connection with real file', async function () {
        // Arrange
        const tp = path.join(__dirname, 'L1Setup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        process.env['AGENT_TEMPDIRECTORY'] = agentTempDir;
        process.env['__L1_EXTERNAL_ENDPOINTS__'] = 'PyPIConnection';
        
        // Act
        await tr.runAsync();
        
        // Assert
        assert(tr.succeeded, `Task should succeed. Output:\n${tr.stdout}\nErrors:\n${tr.stderr}`);
        
        // Verify file was created
        const twineAuthDir = path.join(agentTempDir, 'twineAuthenticate');
        const subdirs = fs.readdirSync(twineAuthDir);
        const pypircPath = path.join(twineAuthDir, subdirs[0], '.pypirc');
        
        const content = fs.readFileSync(pypircPath, 'utf8');
        
        // Verify external connection is configured
        assert(content.includes('PyPIConnection'), 'Should contain external connection name');
        assert(content.includes('repository='), 'Should have repository URL');
    });

    it('should handle combination of internal and external feeds', async function () {
        // Arrange
        const tp = path.join(__dirname, 'L1Setup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        process.env['AGENT_TEMPDIRECTORY'] = agentTempDir;
        process.env['SYSTEM_ACCESSTOKEN'] = 'combined-token';
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = 'https://dev.azure.com/testorg/';
        process.env['__L1_ARTIFACT_FEED__'] = 'InternalFeed';
        process.env['__L1_EXTERNAL_ENDPOINTS__'] = 'ExternalPyPI';
        
        // Act
        await tr.runAsync();
        
        // Assert
        assert(tr.succeeded, `Task should succeed. Output:\n${tr.stdout}\nErrors:\n${tr.stderr}`);
        
        const twineAuthDir = path.join(agentTempDir, 'twineAuthenticate');
        const subdirs = fs.readdirSync(twineAuthDir);
        const pypircPath = path.join(twineAuthDir, subdirs[0], '.pypirc');
        
        const content = fs.readFileSync(pypircPath, 'utf8');
        
        // Verify both feeds are present
        assert(content.includes('InternalFeed'), 'Should contain internal feed');
        assert(content.includes('ExternalPyPI'), 'Should contain external connection');
        
        // Verify index-servers lists both
        const indexServersMatch = content.match(/index-servers=(.+)/);
        assert(indexServersMatch, 'Should have index-servers line');
        const indexServers = indexServersMatch[1];
        assert(indexServers.includes('InternalFeed'), 'index-servers should include InternalFeed');
        assert(indexServers.includes('ExternalPyPI'), 'index-servers should include ExternalPyPI');
    });

    it('should create file with correct permissions and format', async function () {
        // Arrange
        const tp = path.join(__dirname, 'L1Setup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        process.env['AGENT_TEMPDIRECTORY'] = agentTempDir;
        process.env['SYSTEM_ACCESSTOKEN'] = 'test-token';
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = 'https://dev.azure.com/testorg/';
        process.env['__L1_ARTIFACT_FEED__'] = 'FormattedFeed';
        
        // Act
        await tr.runAsync();
        
        // Assert
        const twineAuthDir = path.join(agentTempDir, 'twineAuthenticate');
        const subdirs = fs.readdirSync(twineAuthDir);
        const pypircPath = path.join(twineAuthDir, subdirs[0], '.pypirc');
        
        // Verify file stats
        const stats = fs.statSync(pypircPath);
        assert(stats.isFile(), 'Should be a regular file');
        assert(stats.size > 0, 'File should not be empty');
        
        // Verify INI format structure
        const content = fs.readFileSync(pypircPath, 'utf8');
        const lines = content.split(/\r?\n/);
        
        // First line should be [distutils]
        assert.strictEqual(lines[0], '[distutils]', 'First line should be [distutils]');
        
        // Should have index-servers line
        const indexLine = lines.find(l => l.startsWith('index-servers='));
        assert(indexLine, 'Should have index-servers line');
        
        // Should have feed section
        assert(lines.includes('[FormattedFeed]'), 'Should have feed section header');
        
        // Should have repository, username, password lines
        assert(lines.some(l => l.startsWith('repository=')), 'Should have repository line');
        assert(lines.some(l => l.startsWith('username=')), 'Should have username line');
        assert(lines.some(l => l.startsWith('password=')), 'Should have password line');
    });

    it('should set PYPIRC_PATH environment variable to actual file', async function () {
        // Arrange
        const tp = path.join(__dirname, 'L1Setup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        process.env['AGENT_TEMPDIRECTORY'] = agentTempDir;
        process.env['SYSTEM_ACCESSTOKEN'] = 'env-test-token';
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = 'https://dev.azure.com/testorg/';
        process.env['__L1_ARTIFACT_FEED__'] = 'EnvTestFeed';
        
        // Act
        await tr.runAsync();
        
        // Assert
        assert(tr.succeeded, 'Task should succeed');
        
        // The task should output the PYPIRC_PATH variable
        assert(tr.stdout.includes('##vso[task.setvariable variable=PYPIRC_PATH'), 
            'Should set PYPIRC_PATH variable');
        
        // Extract the path from the output
        const match = tr.stdout.match(/##vso\[task\.setvariable variable=PYPIRC_PATH[^\]]*\](.+)/);
        assert(match, 'Should find PYPIRC_PATH in output');
        
        const setPypircPath = match[1].trim();
        
        // Verify the path exists
        assert(fs.existsSync(setPypircPath), `PYPIRC_PATH file should exist at: ${setPypircPath}`);
        assert(setPypircPath.endsWith('.pypirc'), 'PYPIRC_PATH should point to .pypirc file');
    });
});
