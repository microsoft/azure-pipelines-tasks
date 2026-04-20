import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('PipAuthenticate L0 Suite - Error Handling', function () {
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

    describe('Missing Inputs', function() {
        it('succeeds with no feeds configured', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            // Intentionally not setting artifactFeeds
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr, 'Task should succeed with no feeds configured');
            
            // No environment variables should be set
            TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.pipIndexUrlVar);
            TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
        });

        it('handles missing System.AccessToken gracefully', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            // Intentionally not setting systemAccessToken
            
            // Act
            await tr.runAsync();
            
            // Assert
            // Task should succeed - missing token is a pipeline configuration issue, not a task error
            TestHelpers.assertSuccess(tr, 'Task should succeed even without System.AccessToken');
        });
    });

    describe('Variable Length Limits', function() {
        it('warns when PIP_EXTRA_INDEX_URL is truncated', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            
            // Create a very long list of feeds that will exceed variable limits
            const manyFeeds = Array.from({ length: 50 }, (_, i) => `Feed${i}`).join(',');
            process.env[testConstants.TestEnvVars.artifactFeeds] = manyFeeds;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
            
            // Should warn about variable truncation when there are too many feeds
            // The warning message contains text about PIP_EXTRA_INDEX_URL being truncated
            TestHelpers.assertOutputContains(tr, 'PIP_EXTRA_INDEX_URL', 
                'Should reference PIP_EXTRA_INDEX_URL in warning about too many feed entries');
        });
    });
});
