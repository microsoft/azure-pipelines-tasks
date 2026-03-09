// L0 tests for MavenAuthenticate - Input Validation

import * as path from 'path';
import * as assert from 'assert';
import * as fs from 'fs';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import { TestConstants } from './TestConstants';
import { TestEnvVars } from './TestConstants';
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

        // Verify settings.xml was written — proves the task trimmed the feed name
        // and located the correct output path from $USERPROFILE/.m2/
        const xmlContent = TestHelpers.readSettingsXml();
        assert(xmlContent !== null, 'settings.xml should be written even when feed name has surrounding whitespace');
        assert(
            xmlContent!.includes('<id>feedName1</id>'),
            'Whitespace around feed name should be trimmed in settings.xml <id>'
        );
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

        // Verify the task created the .m2 directory and wrote settings.xml inside it
        const settingsXmlPath = TestHelpers.getSettingsXmlPath();
        assert(
            fs.existsSync(settingsXmlPath),
            `settings.xml should be created at the agent home path: ${settingsXmlPath}`
        );
        assert(
            settingsXmlPath.includes(path.join('.m2', 'settings.xml')),
            'settings.xml must reside in the .m2 subdirectory of the agent home dir'
        );
    });

});
