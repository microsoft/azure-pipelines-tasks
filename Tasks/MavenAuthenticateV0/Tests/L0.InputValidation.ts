// L0 tests for MavenAuthenticate - Input Validation

import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import { TestConstants } from './TestConstants';
import { TestEnvVars } from './TestSetup';
import { TestHelpers } from './TestHelpers';

describe('MavenAuthenticate L0 - Input Validation', function () {
    this.timeout(20000);

    beforeEach(function () {
        TestHelpers.beforeEach();
    });

    afterEach(function () {
        TestHelpers.afterEach();
    });

    it('should handle empty feeds input gracefully', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = '';
        process.env[TestEnvVars.mavenServiceConnections] = '';
        process.env[TestEnvVars.m2FolderExists] = 'true';

        // Act
        await tr.runAsync();

        // Assert
        // Check for warning (appears as loc_mock key in test output)
        TestHelpers.assertOutputContains(tr, 'Warning_NoEndpointsToAuth');
        TestHelpers.assertSuccess(tr, 'Task should succeed with warning');
    });

    it('should handle single feed with whitespace', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = '  feedName1  ';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });

    it('should handle multiple feeds with mixed whitespace', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = 'feedName1, feedName2 ,feedName3';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });

    it('should handle empty service connections input', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = '';
        process.env[TestEnvVars.mavenServiceConnections] = '';
        process.env[TestEnvVars.m2FolderExists] = 'true';

        // Act
        await tr.runAsync();

        // Assert
        // Check for warning (appears as loc_mock key in test output)
        TestHelpers.assertOutputContains(tr, 'Warning_NoEndpointsToAuth');
        TestHelpers.assertSuccess(tr);
    });

    it('should handle service connections with whitespace', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.mavenServiceConnections] = ' tokenBased ';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });

    it('should create .m2 folder if it does not exist', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.m2FolderExists] = 'false';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });

    it('should handle verbosity setting', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.verbosity] = 'detailed';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });

    it('should handle mix of feeds and service connections', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = `${TestConstants.feeds.feedName1},${TestConstants.feeds.feedName2}`;
        process.env[TestEnvVars.mavenServiceConnections] = 'tokenBased,usernamePasswordBased';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });

    it('should handle only feeds without service connections', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.mavenServiceConnections] = '';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });

    it('should handle only service connections without feeds', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = '';
        process.env[TestEnvVars.mavenServiceConnections] = 'tokenBased';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });
});
