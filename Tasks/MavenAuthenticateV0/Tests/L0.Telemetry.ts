// L0 tests for MavenAuthenticate - Telemetry

import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import { TestConstants } from './TestConstants';
import { TestEnvVars } from './TestSetup';
import { TestHelpers } from './TestHelpers';

describe('MavenAuthenticate L0 - Telemetry', function () {
    this.timeout(20000);

    beforeEach(function () {
        TestHelpers.beforeEach();
    });

    afterEach(function () {
        TestHelpers.afterEach();
    });

    it('should emit telemetry for single feed authentication', async () => {
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

    it('should emit telemetry for multiple feeds', async () => {
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
});
