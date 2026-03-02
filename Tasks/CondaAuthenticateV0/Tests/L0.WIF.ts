import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

#if WIF
describe('CondaAuthenticate L0 Suite - Workload Identity Federation', function () {
    this.timeout(20000); // Increased for slower CI environments (especially macOS)

    beforeEach(() => {
        // Clear all test configuration environment variables
        delete process.env[testConstants.TestEnvVars.systemAccessToken];
        delete process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri];
        delete process.env[testConstants.TestEnvVars.systemDebug];
        delete process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection];
        delete process.env[testConstants.TestEnvVars.wifToken];
        delete process.env[testConstants.TestEnvVars.wifShouldFail];
        delete process.env['__throwTelemetryError__'];
    });

    afterEach(() => {
        // Clean up actual environment variables after each test
        delete process.env['ARTIFACTS_CONDA_TOKEN'];
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'];
        delete process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'];
        delete process.env['SYSTEM_DEBUG'];
    });

    describe('WIF Authentication', function() {
        it('successfully authenticates using WIF when service connection is provided', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr, 'Task should succeed with WIF authentication');
            TestHelpers.assertOutputContains(tr, 'Mock WIF: getFederatedWorkloadIdentityCredentials called',
                'Should call WIF credentials provider');
            TestHelpers.assertEnvironmentVariableSet(tr, 'ARTIFACTS_CONDA_TOKEN', testConstants.TestData.wifToken);
            TestHelpers.assertOutputContains(tr, testConstants.TestData.expectedEnvVar,
                'Should set ARTIFACTS_CONDA_TOKEN environment variable');
        });

        it('marks WIF token as secret', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertMarkedAsSecret(tr, testConstants.TestData.wifToken);
            TestHelpers.assertEnvironmentVariableSet(tr, 'ARTIFACTS_CONDA_TOKEN', testConstants.TestData.wifToken);
        });
    });

    describe('WIF Fallback Behavior', function() {
        it('falls back to System.AccessToken when WIF service connection is not provided', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            // Intentionally not setting workloadIdentityServiceConnection
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr, 'Task should succeed with System.AccessToken fallback');
            TestHelpers.assertOutputNotContains(tr, 'Mock WIF: getFederatedWorkloadIdentityCredentials called',
                'Should NOT call WIF credentials provider when service connection not provided');
            TestHelpers.assertEnvironmentVariableSet(tr, 'ARTIFACTS_CONDA_TOKEN', testConstants.TestData.defaultAccessToken);
        });
    });

    describe('WIF Error Handling', function() {
        it('fails gracefully when WIF authentication fails', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.wifShouldFail] = 'true';
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertFailure(tr, 'Task should fail when WIF authentication fails');
            TestHelpers.assertOutputContains(tr, 'Mock WIF: getFederatedWorkloadIdentityCredentials called',
                'Should attempt WIF authentication');
        });
    });

    describe('WIF Telemetry', function() {
        it('emits telemetry with correct federated auth count when using WIF', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr, 'Task should succeed with WIF');
            TestHelpers.assertOutputContains(tr, 'Telemetry emitted:', 'Should emit telemetry');
            TestHelpers.assertOutputContains(tr, '"FederatedFeedAuthCount":1',
                'Should track federated auth count as 1 when WIF succeeds');
        });

        it('emits telemetry with zero federated auth count when using System.AccessToken', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            // Not setting WIF service connection
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'Telemetry emitted:', 'Should emit telemetry');
            TestHelpers.assertOutputContains(tr, '"FederatedFeedAuthCount":0',
                'Should track federated auth count as 0 when using System.AccessToken');
        });
    });
});
#endif
