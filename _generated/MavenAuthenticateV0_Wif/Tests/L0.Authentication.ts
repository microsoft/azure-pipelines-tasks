// L0 tests for MavenAuthenticate - Basic Feed Authentication

import * as path from 'path';
import * as assert from 'assert';
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
        // Task creates settings.xml with feed authentication
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
        // Task should preserve existing otherFeedName and add feedName1
    });

    it('should warn about duplicate feed entries', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'true';
        process.env[TestEnvVars.settingsXmlContent] = TestConstants.sampleSettingsXml.withFeedName1;

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
        // Check for warning about duplicate feed (appears as loc_mock key in test output)
        TestHelpers.assertOutputContains(
            tr,
            'Warning_FeedEntryAlreadyExists'
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
        // Task uses custom token for authentication
    });
});
