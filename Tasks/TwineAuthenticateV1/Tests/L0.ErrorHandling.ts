import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('TwineAuthenticate L0 Suite - Error Handling', function () {
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

    describe('Missing Inputs', function() {
        it('succeeds with no feeds configured', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            // Intentionally not setting artifactFeed
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr, 'Task should succeed with no feeds configured');
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        });

        it('handles missing System.AccessToken gracefully', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            // Intentionally not setting systemAccessToken
            
            // Act
            await tr.runAsync();
            
            // Assert
            // Task should succeed - missing token is a pipeline configuration issue, not a task error
            TestHelpers.assertSuccess(tr, 'Task should succeed even without System.AccessToken');
        });
    });

    describe('Feed Validation', function() {
        it('warns when multiple feeds are specified (only one allowed)', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeed] = 'Feed1,Feed2,Feed3';
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            
            // Should warn about multiple feeds
            assert(tr.warningIssues.length > 0 || tr.stdout.indexOf('warning') >= 0,
                'Should warn when multiple feeds are specified');
        });
    });
});
