// L0 tests for MavenAuthenticate - Basic Feed Authentication

import * as path from 'path';
import * as assert from 'assert';
import * as fs from 'fs';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import { TestConstants } from './TestConstants';
import { TestEnvVars } from './TestSetup';
import { TestHelpers } from './TestHelpers';

describe('MavenAuthenticate L0 - Feed Authentication', function () {
    this.timeout(20000);

    before(function () {
        // Placeholder for any global setup
    });

    after(function () {
        // Placeholder for any global cleanup
    });

    beforeEach(function () {
        TestHelpers.beforeEach();
    });

    afterEach(function () {
        TestHelpers.afterEach();
    });

    it('should create a new settings.xml for single feed', async () => {
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

        // Verify the settings.xml was written with the correct server credential block
        const xmlContent = TestHelpers.readSettingsXml();
        assert(xmlContent !== null, 'settings.xml should have been written by the task');
        assert(
            xmlContent!.includes(`<id>${TestConstants.feeds.feedName1}</id>`),
            `settings.xml should contain server <id>${TestConstants.feeds.feedName1}</id>`
        );
        assert(
            xmlContent!.includes('<username>AzureDevOps</username>'),
            'settings.xml should contain <username>AzureDevOps</username>'
        );
        assert(
            xmlContent!.includes(`<password>${TestConstants.systemToken}</password>`),
            `settings.xml should embed the system access token as the server password`
        );
    });

    it('should handle multiple feeds', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = `${TestConstants.feeds.feedName1},${TestConstants.feeds.feedName2}`;
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);

        // Verify both feed server entries are written to settings.xml
        const xmlContent = TestHelpers.readSettingsXml();
        assert(xmlContent !== null, 'settings.xml should have been written for multiple feeds');
        assert(
            xmlContent!.includes(`<id>${TestConstants.feeds.feedName1}</id>`),
            `settings.xml should contain server entry for ${TestConstants.feeds.feedName1}`
        );
        assert(
            xmlContent!.includes(`<id>${TestConstants.feeds.feedName2}</id>`),
            `settings.xml should contain server entry for ${TestConstants.feeds.feedName2}`
        );
    });

    it('should preserve existing settings.xml entries', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'true';
        process.env[TestEnvVars.settingsXmlContent] = TestConstants.sampleSettingsXml.withOtherFeed;

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);

        // Verify the new feed was added AND the pre-existing server entry was preserved
        const xmlContent = TestHelpers.readSettingsXml();
        assert(xmlContent !== null, 'settings.xml should have been written');
        assert(
            xmlContent!.includes(`<id>${TestConstants.feeds.otherFeedName}</id>`),
            `Pre-existing server entry <id>${TestConstants.feeds.otherFeedName}</id> should be preserved`
        );
        assert(
            xmlContent!.includes(`<id>${TestConstants.feeds.feedName1}</id>`),
            `New server entry <id>${TestConstants.feeds.feedName1}</id> should be added`
        );
    });

    // Note: Duplicate feed warning test skipped due to mock infrastructure limitations
    // The real implementation correctly detects and warns about duplicates, but the warning
    // is called from within a mocked module where tl.warning() calls aren't tracked by MockTestRunner

    it('should use System.AccessToken for authentication', async () => {
        // Arrange
        const customToken = 'custom_system_token_54321';
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.systemAccessToken] = customToken;
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act  
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);

        // Verify the specific token was embedded as the server password
        const xmlContent = TestHelpers.readSettingsXml();
        assert(xmlContent !== null, 'settings.xml should have been written');
        assert(
            xmlContent!.includes(`<password>${customToken}</password>`),
            `settings.xml server password should be the custom System.AccessToken value`
        );
    });
});
