import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('CondaAuthenticate L0 Suite - Authentication', function () {
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
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, 'ARTIFACTS_CONDA_TOKEN', testConstants.TestData.defaultAccessToken);
            TestHelpers.assertOutputContains(tr, testConstants.TestData.expectedEnvVar,
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
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertMarkedAsSecret(tr, testConstants.TestData.secretToken);
            TestHelpers.assertEnvironmentVariableSet(tr, 'ARTIFACTS_CONDA_TOKEN', testConstants.TestData.secretToken);
        });

        it('handles empty access token gracefully', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.emptyToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            // Task doesn't validate tokens - pipeline configuration should handle this
            // Empty token will be set as-is (task-lib treats empty string as undefined)
            TestHelpers.assertSuccess(tr, 'Task succeeds - token validation is not the task\'s responsibility');
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
            TestHelpers.assertSuccess(tr, 'Task should work with Azure DevOps hosted environment');
            TestHelpers.assertEnvironmentVariableSet(tr, 'ARTIFACTS_CONDA_TOKEN', testConstants.TestData.adoHostedToken);
            TestHelpers.assertOutputContains(tr, testConstants.TestData.expectedEnvVar,
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

    describe('Logging', function() {
        it('logs correct environment variable name in output', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, testConstants.TestData.expectedEnvVar,
                `Should reference correct environment variable ${testConstants.TestData.expectedEnvVar} in output`);
        });
    });
});
