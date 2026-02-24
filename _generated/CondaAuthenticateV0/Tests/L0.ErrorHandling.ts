import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('CondaAuthenticate L0 Suite - Error Handling', function () {
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

    describe('Missing Inputs', function() {
        it('handles missing System.AccessToken gracefully', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            // Intentionally not setting systemAccessToken
            
            // Act
            await tr.runAsync();
            
            // Assert
            // Task should succeed - missing token is a pipeline configuration issue, not a task error
            TestHelpers.assertSuccess(tr, 'Task should succeed even without System.AccessToken');
        });
    });
});
