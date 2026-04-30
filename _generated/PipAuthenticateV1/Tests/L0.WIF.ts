import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('PipAuthenticate L0 Suite - Workload Identity Federation', function () {
    this.timeout(10000);

    beforeEach(() => {
        // Clear all test configuration environment variables
        delete process.env[testConstants.TestEnvVars.systemAccessToken];
        delete process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri];
        delete process.env[testConstants.TestEnvVars.systemDebug];
        delete process.env[testConstants.TestEnvVars.artifactFeeds];
        delete process.env[testConstants.TestEnvVars.onlyAddExtraIndex];
        delete process.env[testConstants.TestEnvVars.externalEndpoints];
        delete process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection];
        delete process.env[testConstants.TestEnvVars.feedUrl];
        delete process.env[testConstants.TestEnvVars.wifToken];
        delete process.env[testConstants.TestEnvVars.wifShouldFail];
        delete process.env['__throwTelemetryError__'];
    });

    afterEach(() => {
        // Clean up actual environment variables after each test
        delete process.env['PIP_INDEX_URL'];
        delete process.env['PIP_EXTRA_INDEX_URL'];
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
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            
            // Verify WIF credentials are used
            const pipIndexUrl = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf(testConstants.TestData.wifServiceConnection) >= 0,
                'PIP_INDEX_URL should contain WIF service connection name as username');
            
            TestHelpers.assertOutputContains(tr, 'Mock WIF: getFederatedWorkloadIdentityCredentials',
                'Should call WIF authentication method');
            TestHelpers.assertOutputContains(tr, 'Successfully added auth for feed',
                'Should log message about successfully adding federated feed auth');
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
    });
});
