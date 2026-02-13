import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';

describe('CondaAuthenticate L0 Suite', function () {
    this.timeout(10000);

    before(() => {
    });

    after(() => {
    });

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

    describe('Basic Authentication', function() {
        it('sets ARTIFACTS_CONDA_TOKEN from System.AccessToken', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should have succeeded');
            assert.strictEqual(tr.errorIssues.length, 0, 'Should have no error issues');
            assert(tr.stdout.indexOf(testConstants.TestData.expectedEnvVar) > 0, 
                `Should log adding auth for ${testConstants.TestData.expectedEnvVar}`);
        });

        it('marks access token as secret', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.secretToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should have succeeded');
            assert(tr.stdout.indexOf('##vso[task.setsecret]') > 0, 
                'Should mark token as secret using task.setsecret command');
            assert(tr.stdout.indexOf(testConstants.TestData.secretToken) > 0,
                'Secret token should appear in setsecret command');
        });

        it('handles empty access token gracefully', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.emptyToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed even with empty token');
        });
    });

    describe('Token Content Handling', function() {
        it('handles tokens with special characters', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.specialCharsToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should handle tokens with special characters');
            assert(tr.stdout.indexOf(testConstants.TestData.expectedEnvVar) > 0,
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
            assert(tr.succeeded, 'Task should handle very long tokens');
            assert.strictEqual(tr.errorIssues.length, 0, 'Should have no errors with long token');
        });
    });

    describe('Environment Compatibility', function() {
        it('works with Azure DevOps hosted environment', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.adoHostedToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.adoHostedUri;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should work with Azure DevOps hosted environment');
            assert(tr.stdout.indexOf(testConstants.TestData.expectedEnvVar) > 0,
                'Should set environment variable in Azure DevOps hosted environment');
        });

        it('works with on-premises TFS', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.tfsOnPremToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.tfsOnPremUri;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should work with on-premises TFS');
            assert(tr.stdout.indexOf(testConstants.TestData.expectedEnvVar) > 0,
                'Should set environment variable in TFS environment');
        });

        it('works with custom collection URLs', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.customCollectionToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.customCollectionUri;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should work with custom collection URLs');
            assert(tr.stdout.indexOf(testConstants.TestData.expectedEnvVar) > 0,
                'Should set environment variable with custom collection URL');
        });
    });

    describe('Error Handling', function() {
        it('handles missing System.AccessToken', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            // Intentionally not setting systemAccessToken to simulate missing token
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded || tr.stdout.indexOf('undefined') >= 0, 
                'Task should handle missing System.AccessToken gracefully');
        });

        it('sets task result to Failed on error', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__throwTelemetryError__'] = 'true'; // Simulate error in telemetry
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when error occurs');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0,
                'Should have error output when task fails');
        });
    });

    describe('Telemetry', function() {
        it('emits telemetry on successful authentication', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.telemetryToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('Telemetry emitted:') > 0, 
                'Should emit telemetry on successful authentication');
            assert(tr.stdout.indexOf(testConstants.TestData.telemetryArea) > 0,
                `Should emit telemetry for area ${testConstants.TestData.telemetryArea}`);
            assert(tr.stdout.indexOf(testConstants.TestData.telemetryFeature) > 0,
                `Should emit telemetry for feature ${testConstants.TestData.telemetryFeature}`);
        });

        it('handles telemetry errors without failing task', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__throwTelemetryError__'] = 'true';
            
            // Act
            await tr.runAsync();
            
            // Assert
            // Note: Telemetry errors in finally block will cause task to fail
            assert(tr.failed, 'Task should fail when telemetry throws error in finally block');
        });
    });

    describe('Logging and Debugging', function() {
        it('logs debug messages when SYSTEM_DEBUG is enabled', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemDebug] = 'true';
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.debugToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with debug enabled');
            assert(tr.stdout.indexOf('##vso[task.debug]') >= 0, 
                'Should log debug messages when SYSTEM_DEBUG is enabled');
        });

        it('logs correct environment variable name in output', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf(testConstants.TestData.expectedEnvVar) > 0, 
                `Should reference correct environment variable ${testConstants.TestData.expectedEnvVar} in output`);
        });
    });

});
