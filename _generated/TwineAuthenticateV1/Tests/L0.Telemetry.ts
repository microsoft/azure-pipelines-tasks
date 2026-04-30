import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('TwineAuthenticate L0 Suite - Telemetry & Logging', function () {
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

    describe('Telemetry Emission', function() {
        it('emits telemetry on successful authentication', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'Telemetry emitted:',
                'Should emit telemetry on successful authentication');
            TestHelpers.assertOutputContains(tr, testConstants.TestData.telemetryArea,
                'Telemetry should include correct area');
            TestHelpers.assertOutputContains(tr, testConstants.TestData.telemetryFeature,
                'Telemetry should include correct feature name');
            TestHelpers.assertOutputContains(tr, 'InternalFeedAuthCount',
                'Telemetry should include internal feed count');
        });

        it('includes correct feed counts in telemetry', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.externalEndpoints] = testConstants.TestData.externalServiceEndpoint;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'InternalFeedAuthCount',
                'Telemetry should track internal feed count');
            TestHelpers.assertOutputContains(tr, 'ExternalFeedAuthCount',
                'Telemetry should track external feed count');
        });

        it('handles telemetry error appropriately', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.throwTelemetryError] = 'true';
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            // Current implementation: telemetry errors cause task failure
            // This could be improved to catch telemetry errors, but for now test actual behavior
            TestHelpers.assertFailure(tr);
        });
    });

    describe('Debug Logging', function() {
        it('logs debug messages when SYSTEM_DEBUG is enabled', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemDebug] = 'true';
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with debug enabled');
            assert(tr.stdout.indexOf('##vso[task.debug]') >= 0, 
                'Should log debug messages when SYSTEM_DEBUG is enabled');
        });

        it('logs informational messages about feeds', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            // Should log success message about adding auth
            // Message format: "Successfully added auth for X internal feeds, Y external feeds, and Z federated feeds."
            TestHelpers.assertOutputContains(tr, 'Successfully added auth',
                'Should log informational message about successful authentication');
        });
    });
});
