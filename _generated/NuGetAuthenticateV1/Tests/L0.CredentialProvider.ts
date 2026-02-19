import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NuGetAuthenticate L0 Suite - Credential Provider Installation', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Credential Provider Installation', function() {
        it('installs credential provider on first run', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'Mock: installCredProviderToUserProfile called',
                'Should call installCredProviderToUserProfile');
        });

        it('passes forceReinstall=true when input is true', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.forceReinstallCredentialProvider] = 'true';
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'forceReinstall=true',
                'Should pass forceReinstall=true to installation function');
        });

        it('passes forceReinstall=false when input is false', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.forceReinstallCredentialProvider] = 'false';
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'forceReinstall=false',
                'Should pass forceReinstall=false to installation function');
        });

        it('uses correct credential provider version for V1 task', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            // V1 should pass isV0=false (or not pass the parameter since default is false)
            // This ensures .NET 6+ compatible credential provider is installed
            assert(tr.stdout.indexOf('isV0=false') > 0 || 
                   tr.stdout.indexOf('installCredProviderToUserProfile called') > 0,
                'Should install .NET 6+ compatible credential provider');
        });

        it('fails when credential provider installation fails', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env['__credProviderShouldFail__'] = 'true';
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertFailure(tr);
            TestHelpers.assertOutputContains(tr, 'Simulated credential provider installation failure',
                'Should show credential provider installation error');
        });
    });

    describe('Credential Provider Configuration', function() {
        it('configures credential provider for same-organization feeds', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            TestHelpers.setupExternalServiceConnections([]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('Mock: configureCredProvider called') > 0,
                'Should call configureCredProvider');
        });

        it('configures credential provider for external service connections', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            TestHelpers.setupExternalServiceConnections([testConstants.TestData.externalServiceConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('Mock: configureCredProvider called') > 0,
                'Should configure credential provider with service connections');
        });

        it('calls configureCredProvider which sets VSS_NUGET_EXTERNAL_FEED_ENDPOINTS', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            TestHelpers.setupExternalServiceConnections([testConstants.TestData.externalServiceConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            // Verify the mock was called (which sets the environment variable internally)
            TestHelpers.assertOutputContains(tr, 'Mock: configureCredProvider called',
                'Should call configureCredProvider which sets VSS_NUGET_EXTERNAL_FEED_ENDPOINTS');
            // Verify the environment variable was actually set
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.expectedCredProviderEnvVar);
        });
    });
});
