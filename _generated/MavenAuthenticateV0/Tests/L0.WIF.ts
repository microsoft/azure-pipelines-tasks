// L0 tests for MavenAuthenticate - Workload Identity Federation (WIF)

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import { TestConstants } from './TestConstants';
import { TestEnvVars } from './TestConstants';
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

        // Verify the WIF federated token — not the system PAT — was written as the server password.
        // If the system token appears here, the task silently fell back to PAT auth.
        const xmlContent = TestHelpers.readSettingsXml();
        assert(xmlContent !== null, 'settings.xml should have been written for WIF auth');
        assert(
            xmlContent!.includes(`<password>${TestConstants.wif.token}</password>`),
            'settings.xml password should be the WIF federated token'
        );
        assert(
            !xmlContent!.includes(`<password>${TestConstants.systemToken}</password>`),
            'settings.xml must NOT contain the system PAT — WIF should not silently fall back to PAT auth'
        );
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

        // Both server entries must use the federated token, not the system PAT
        const xmlContent = TestHelpers.readSettingsXml();
        assert(xmlContent !== null, 'settings.xml should be written for multi-feed WIF auth');
        const wifPasswordOccurrences = (xmlContent!.match(new RegExp(`<password>${TestConstants.wif.token}</password>`, 'g')) || []).length;
        assert(
            wifPasswordOccurrences >= 2,
            `Both feed server entries should use the WIF token as password — found ${wifPasswordOccurrences} occurrence(s)`
        );
        assert(
            !xmlContent!.includes(`<password>${TestConstants.systemToken}</password>`),
            'System PAT must not appear in settings.xml when WIF is active'
        );
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
        // No workloadIdentityServiceConnection set — PAT auth expected

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);

        // Contrast with WIF tests: without WIF the system PAT IS the correct credential
        const xmlContent = TestHelpers.readSettingsXml();
        assert(xmlContent !== null, 'settings.xml should be written for standard (PAT) auth');
        assert(
            xmlContent!.includes(`<password>${TestConstants.systemToken}</password>`),
            'Non-WIF auth should use system PAT as the server password'
        );
        // And no WIF token should appear (it was never acquired)
        assert(
            !xmlContent!.includes(`<password>${TestConstants.wif.token}</password>`),
            'WIF token must not appear in settings.xml when WIF is not configured'
        );
    });
});
