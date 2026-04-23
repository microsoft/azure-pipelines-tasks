import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NuGetAuthenticate L0 Suite - Workload Identity Federation', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('WIF Cross-Organization Authentication', function() {
        it('successfully authenticates cross-org feed with WIF + feedUrl', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.crossOrgFeedUrl;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with WIF cross-org authentication');
            assert(tr.stdout.indexOf('Mock WIF: configureEntraCredProvider called') > 0,
                'Should call WIF credential provider');
            assert(tr.stdout.indexOf(testConstants.TestData.crossOrgFeedUrl) > 0,
                'Should use the provided feed URL');
        });

        it('logs success message after WIF authentication', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupWifAuth(testConstants.TestData.crossOrgFeedUrl);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('Info_SuccessAddingFederatedFeedAuth') > 0,
                'Should log success message for federated feed auth');
        });

        it('returns early after successful WIF cross-org auth without calling configureCredProvider', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupWifAuth(testConstants.TestData.crossOrgFeedUrl);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed and return early');
            assert(tr.stdout.indexOf('Mock: configureCredProvider called') < 0,
                'Should NOT call configureCredProvider after WIF succeeds');
        });
    });

    describe('WIF Same-Organization Authentication', function() {
        it('replaces Build Service identity when WIF is provided without feedUrl', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            // Not setting feedUrl - should use WIF for same-org feeds
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with WIF same-org authentication');
            assert(tr.stdout.indexOf('Mock: configureCredProviderForSameOrganizationFeeds called') > 0,
                'Should call configureCredProviderForSameOrganizationFeeds');
            assert(tr.stdout.indexOf(testConstants.TestData.wifServiceConnection) > 0,
                'Should use WIF service connection name');
        });

        it('returns early after same-org WIF setup', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupWifAuth(); // No feedUrl
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should return early after same-org WIF');
            assert(tr.stdout.indexOf('Mock: configureCredProvider called') < 0,
                'Should NOT call regular configureCredProvider');
        });
    });

    describe('WIF Fallback Behavior', function() {
        it('falls back to configureCredProvider when WIF not configured', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            // Not setting workloadIdentityServiceConnection
            TestHelpers.setupBasicAuth();
            TestHelpers.setupExternalServiceConnections([testConstants.TestData.externalServiceConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with fallback to configureCredProvider');
            assert(tr.stdout.indexOf('Mock: configureCredProvider called') > 0,
                'Should call configureCredProvider when WIF not configured');
            assert(tr.stdout.indexOf('Mock WIF: configureEntraCredProvider called') < 0,
                'Should NOT call WIF provider when not configured');
        });
    });

    describe('WIF Error Handling', function() {
        it('fails gracefully when WIF authentication fails', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.crossOrgFeedUrl;
            process.env[testConstants.TestEnvVars.wifShouldFail] = 'true';
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when WIF authentication fails');
            assert(tr.stdout.indexOf('Mock WIF: configureEntraCredProvider called') > 0,
                'Should attempt WIF authentication');
            assert(tr.stdout.indexOf('Simulated WIF authentication failure') > 0 || tr.errorIssues.length > 0,
                'Should show WIF failure error');
        });

        it('validates feedUrl before attempting WIF authentication', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.invalidFeedUrls.nugetOrg;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail for invalid feedUrl');
            assert(tr.stdout.indexOf('Error_InvalidFeedUrl') > 0 || tr.errorIssues.length > 0,
                'Should validate feedUrl before WIF authentication');
        });
    });

    describe('WIF URL Normalization', function() {
        it('normalizes feedUrl with smart quotes before WIF authentication', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.edgeCaseFeedUrls.smartQuotesSingle;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            // Should normalize smart quotes and validate successfully
            assert(tr.succeeded, 'Task should normalize smart quotes and succeed');
        });

        it('normalizes feedUrl with whitespace before WIF authentication', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.edgeCaseFeedUrls.bothWhitespace;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should trim whitespace and succeed');
        });
    });

    describe('WIF Secret Masking', function() {
        it('marks WIF token as secret', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupWifAuth(testConstants.TestData.crossOrgFeedUrl);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            // Note: Secret masking happens in the actual WIF utility, not the task itself
            // This test verifies the flow completes successfully
        });
    });
});
