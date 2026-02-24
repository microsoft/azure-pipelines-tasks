// L0 tests for MavenAuthenticate - Workload Identity Federation (WIF)

import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import { TestConstants } from './TestConstants';
import { TestEnvVars } from './TestSetup';
import { TestHelpers } from './TestHelpers';

describe('MavenAuthenticate L0 - Workload Identity Federation (WIF)', function () {
    this.timeout(20000);

    beforeEach(function () {
        TestHelpers.beforeEach();
    });

    afterEach(function () {
        TestHelpers.afterEach();
    });

    it('should authenticate using WIF when service connection provided', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.workloadIdentityServiceConnection] = TestConstants.wif.serviceConnectionName;
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.wifToken] = TestConstants.wif.token;
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        // Check for success message (appears as loc_mock key in test output)
        TestHelpers.assertOutputContains(
            tr,
            'Info_SuccessAddingFederatedFeedAuth'
        );
        TestHelpers.assertSuccess(tr);
    });

    it('should authenticate multiple feeds with WIF', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.workloadIdentityServiceConnection] = TestConstants.wif.serviceConnectionName;
        process.env[TestEnvVars.artifactsFeeds] = `${TestConstants.feeds.feedName1},${TestConstants.feeds.feedName2}`;
        process.env[TestEnvVars.wifToken] = TestConstants.wif.token;
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });

    it('should warn when WIF configured but no feeds specified', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.workloadIdentityServiceConnection] = TestConstants.wif.serviceConnectionName;
        process.env[TestEnvVars.artifactsFeeds] = '';
        process.env[TestEnvVars.wifToken] = TestConstants.wif.token;
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        // Should warn about no feeds and still succeed
        TestHelpers.assertOutputContains(
            tr,
            'Warning_NoEndpointsToAuth'
        );
        TestHelpers.assertSuccess(tr);
    });

    it('should warn when WIF token cannot be generated', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.workloadIdentityServiceConnection] = TestConstants.wif.serviceConnectionName;
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.wifShouldFail] = 'true';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        // Check for warning (appears as loc_mock key in test output)
        TestHelpers.assertOutputContains(
            tr,
            'Warning_TokenNotGenerated'
        );
        TestHelpers.assertSuccess(tr, 'Task should succeed with warning');
    });

    it('should fall back to standard auth when WIF not configured', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });
});
