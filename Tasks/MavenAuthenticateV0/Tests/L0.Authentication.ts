// L0 tests for MavenAuthenticate - Basic Feed Authentication

import * as path from 'path';
import * as assert from 'assert';
import * as fs from 'fs';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import { TestConstants } from './TestConstants';
import { TestEnvVars } from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('MavenAuthenticate L0 - Feed Authentication', function () {
    this.timeout(20000);

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

        // Verify the file is at the agent home dir path ($USERPROFILE/.m2/).
        // TestSetup redirects USERPROFILE/HOME to __dirname/testhome, so the file must appear there.
        const settingsXmlPath = TestHelpers.getSettingsXmlPath();
        assert(
            fs.existsSync(settingsXmlPath),
            `settings.xml must be written at the agent home path: ${settingsXmlPath}`
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
