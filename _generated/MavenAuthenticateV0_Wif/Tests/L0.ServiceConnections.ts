// L0 tests for MavenAuthenticate - Service Connection Authentication

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import { TestConstants } from './TestConstants';
import { TestEnvVars } from './TestSetup';
import { TestHelpers } from './TestHelpers';

describe('MavenAuthenticate L0 - Service Connections', function () {
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

    it('should add auth for token-based service connection', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.mavenServiceConnections] = 'tokenBased';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
        // Task creates settings.xml with tokenBased service connection
    });

    it('should add auth for username/password service connection', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.mavenServiceConnections] = 'usernamePasswordBased';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });

    it('should add auth for private key service connection', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.mavenServiceConnections] = 'privateKeyBased';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });

    it('should add auth for multiple service connection types', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.mavenServiceConnections] = 'tokenBased,usernamePasswordBased,privateKeyBased';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });

    it('should support mixed feed and service connection authentication', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.mavenServiceConnections] = 'tokenBased';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
    });
});
