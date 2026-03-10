import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('PipAuthenticate L0 Suite - Token Handling', function () {
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

    describe('Token Edge Cases', function() {
        it('handles tokens with special characters', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.specialCharsToken;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr, 'Task should handle tokens with special characters');
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        });

        it('handles very long tokens (2048 characters)', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.longToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr, 'Task should handle very long tokens');
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        });

        it('handles empty access token gracefully', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.emptyToken;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            // Task doesn't validate tokens - pipeline configuration should handle this
            TestHelpers.assertSuccess(tr, 'Task succeeds - token validation is not the task\'s responsibility');
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        });
    });
});
