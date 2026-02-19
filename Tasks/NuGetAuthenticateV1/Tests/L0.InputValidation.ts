import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NuGetAuthenticate L0 Suite - Input Validation and Error Handling', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Input Combination Errors', function() {
#if WIF
        it('fails when both nuGetServiceConnections and workloadIdentityServiceConnection are provided', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.nuGetServiceConnections] = 'TestServiceConnection1';
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            TestHelpers.setupExternalServiceConnections([testConstants.TestData.externalServiceConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when both nuGetServiceConnections and WIF connection are provided');
            assert(tr.stdout.indexOf('Error_NuGetWithWIFNotSupported') > 0 || tr.errorIssues.length > 0,
                'Should show error about conflicting inputs');
        });

        it('warns when feedUrl is provided without workloadIdentityServiceConnection', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.validFeedUrls.devAzure;
            // Not setting workloadIdentityServiceConnection
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed but with warning');
            assert(tr.stdout.indexOf('Warn_IgnoringFeedUrl') > 0 || tr.warningIssues.length > 0,
                'Should warn about ignoring feedUrl');
        });

        it('fails when feedUrl is invalid format', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.invalidFeedUrls.nugetOrg;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when feedUrl is invalid');
            assert(tr.stdout.indexOf('Error_InvalidFeedUrl') > 0 || tr.errorIssues.length > 0,
                'Should show invalid feed URL error');
        });
#endif

        it('succeeds with empty nuGetServiceConnections', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            TestHelpers.setupExternalServiceConnections([]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with empty service connections');
        });

        it('handles null/undefined inputs gracefully', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            // Not setting any optional inputs
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should handle missing optional inputs');
        });
    });

    describe('forceReinstallCredentialProvider Input', function() {
        it('reinstalls credential provider when forceReinstallCredentialProvider is true', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.forceReinstallCredentialProvider] = 'true';
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('installCredProviderToUserProfile called with forceReinstall=true') > 0,
                'Should call installCredProviderToUserProfile with forceReinstall=true');
        });

        it('skips reinstall when forceReinstallCredentialProvider is false', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.forceReinstallCredentialProvider] = 'false';
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('installCredProviderToUserProfile called with forceReinstall=false') > 0,
                'Should call installCredProviderToUserProfile with forceReinstall=false');
        });

        it('uses default value when forceReinstallCredentialProvider is not specified', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            // Not setting forceReinstallCredentialProvider
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with default value');
            assert(tr.stdout.indexOf('installCredProviderToUserProfile called') > 0,
                'Should call installCredProviderToUserProfile');
        });
    });

    describe('Input Alias Support', function() {
        it('supports workloadIdentityServiceConnection input name', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.validFeedUrls.devAzure;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with workloadIdentityServiceConnection');
        });

        // Note: azureDevOpsServiceConnection alias testing would require reading both input names
        // This is handled in the actual task code with: tl.getInput("workloadIdentityServiceConnection") || tl.getInput("azureDevOpsServiceConnection")
    });
});
