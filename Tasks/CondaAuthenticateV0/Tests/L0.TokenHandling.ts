import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('CondaAuthenticate L0 Suite - Token Handling', function () {
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

    describe('Token Edge Cases', function() {
        it('handles tokens with special characters', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.specialCharsToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr, 'Task should handle tokens with special characters');
            // Don't validate exact value due to task library escaping (e.g., % becomes %AZP25)
            // Just verify the variable was set
            TestHelpers.assertEnvironmentVariableSet(tr, 'ARTIFACTS_CONDA_TOKEN');
            TestHelpers.assertOutputContains(tr, testConstants.TestData.expectedEnvVar,
                'Should successfully set environment variable even with special characters');
        });

        it('handles very long tokens (2048 characters)', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.longToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr, 'Task should handle very long tokens');
            TestHelpers.assertEnvironmentVariableSet(tr, 'ARTIFACTS_CONDA_TOKEN', testConstants.TestData.longToken);
        });
    });
});
