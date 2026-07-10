import * as path from 'path';
import * as assert from 'assert';
import * as fs from 'fs';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

const tempDir = path.join(__dirname, 'temp');

describe('TwineAuthenticate L0 Suite - Workload Identity Federation', function () {
    this.timeout(10000);

    beforeEach(() => {
        // Clear all test configuration environment variables
        delete process.env[testConstants.TestEnvVars.systemAccessToken];
        delete process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri];
        delete process.env[testConstants.TestEnvVars.systemDebug];
        delete process.env[testConstants.TestEnvVars.artifactFeed];
        delete process.env[testConstants.TestEnvVars.externalEndpoints];
        delete process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection];
        delete process.env[testConstants.TestEnvVars.feedUrl];
        delete process.env[testConstants.TestEnvVars.wifToken];
        delete process.env[testConstants.TestEnvVars.wifShouldFail];
        delete process.env['__throwTelemetryError__'];
    });

    afterEach(() => {
        // Clean up actual environment variables after each test
        delete process.env['PYPIRC_PATH'];
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['SYSTEM_DEBUG'];
    });

    describe('WIF Authentication', function() {
        it('authenticates using workload identity federation', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
            
            // Verify WIF credentials in .pypirc
            const pypircFile = path.join(tempDir, '.pypirc');
            const fileContent = fs.readFileSync(pypircFile, 'utf-8');
            assert(fileContent.indexOf(testConstants.TestData.wifServiceConnection) >= 0,
                '.pypirc should contain WIF service connection name');
            assert(fileContent.indexOf(testConstants.TestData.wifToken) >= 0,
                '.pypirc should contain WIF token');
            
            TestHelpers.assertOutputContains(tr, 'Mock WIF: getFederatedWorkloadIdentityCredentials',
                'Should call WIF authentication method');
        });

        it('creates .pypirc with WIF credentials', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            
            // Verify .pypirc format
            const pypircFile = path.join(tempDir, '.pypirc');
            const fileContent = fs.readFileSync(pypircFile, 'utf-8');
            assert(fileContent.indexOf('[distutils]') >= 0, 'Should have [distutils] section');
            assert(fileContent.indexOf('repository=') >= 0, 'Should have repository field');
            assert(fileContent.indexOf(`username=${testConstants.TestData.wifServiceConnection}`) >= 0,
                'Username should be WIF service connection name');
        });

        it('emits telemetry for WIF authentication', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'Telemetry emitted:',
                'Should emit telemetry for WIF authentication');
            TestHelpers.assertOutputContains(tr, 'FederatedFeedAuthCount',
                'Telemetry should include federated feed auth count');
        });
    });

    describe('WIF Error Handling', function() {
        it('fails when WIF authentication fails', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            process.env[testConstants.TestEnvVars.wifShouldFail] = 'true';
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertFailure(tr);
            TestHelpers.assertOutputContains(tr, 'Failed to add authentication',
                'Should show generic error message when WIF throws exception');
        });

        it('fails when WIF returns null token', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            // Intentionally not setting wifToken - will return undefined
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertFailure(tr);
            TestHelpers.assertOutputContains(tr, 'Unable to get federated credentials from service connection',
                'Should fail when WIF returns null/undefined token');
        });

        it('fails when only service connection is provided without feed URL', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            // Intentionally not setting feedUrl
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertFailure(tr);
            TestHelpers.assertOutputContains(tr, 'Both feed url and service connection need to be set',
                'Should fail when feed URL is missing');
        });

        it('fails when only feed URL is provided without service connection', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            // Intentionally not setting workloadIdentityServiceConnection
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertFailure(tr);
            TestHelpers.assertOutputContains(tr, 'Both feed url and service connection need to be set',
                'Should fail when service connection is missing');
        });
    });
});
