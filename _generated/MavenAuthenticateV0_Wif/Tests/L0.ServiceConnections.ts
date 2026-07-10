// L0 tests for MavenAuthenticate - Service Connection Authentication

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import { TestConstants } from './TestConstants';
import { TestEnvVars } from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('MavenAuthenticate L0 - Service Connections', function () {
    this.timeout(20000);

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
        const xmlContent = TestHelpers.readSettingsXml();
        assert(xmlContent !== null, 'settings.xml should be written for token-based service connection');
        assert(
            xmlContent!.includes(`<id>${TestConstants.serviceConnections.tokenBased.id}</id>`),
            'settings.xml should contain the service connection repository id'
        );
        assert(
            xmlContent!.includes(`<password>${TestConstants.serviceConnections.tokenBased.token}</password>`),
            'settings.xml should contain the service connection token as the server password'
        );
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
        const xmlContent = TestHelpers.readSettingsXml();
        assert(xmlContent !== null, 'settings.xml should be written for username/password service connection');
        assert(
            xmlContent!.includes(`<id>${TestConstants.serviceConnections.usernamePassword.id}</id>`),
            'settings.xml should contain the service connection repository id'
        );
        assert(
            xmlContent!.includes(`<username>${TestConstants.serviceConnections.usernamePassword.username}</username>`),
            'settings.xml should contain the service connection username'
        );
        assert(
            xmlContent!.includes(`<password>${TestConstants.serviceConnections.usernamePassword.password}</password>`),
            'settings.xml should contain the service connection password'
        );
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
