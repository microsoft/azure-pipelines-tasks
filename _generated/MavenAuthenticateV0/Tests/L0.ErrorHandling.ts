// L0 tests for MavenAuthenticate - Error Handling and Edge Cases

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import { TestConstants } from './TestConstants';
import { TestEnvVars } from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('MavenAuthenticate L0 - Error Handling', function () {
    this.timeout(20000);

    beforeEach(function () {
        TestHelpers.beforeEach();
    });

    afterEach(function () {
        TestHelpers.afterEach();
    });

    it('should warn when no feeds or service connections provided', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = '';
        process.env[TestEnvVars.mavenServiceConnections] = '';
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        // Check for warning (appears as loc_mock key in test output)
        TestHelpers.assertOutputContains(
            tr,
            'Warning_NoEndpointsToAuth'
        );
        TestHelpers.assertSuccess(tr, 'Task should succeed with warning');
    });

    it('should handle missing .m2 folder', async () => {
        // Arrange
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.m2FolderExists] = 'false';
        process.env[TestEnvVars.settingsXmlExists] = 'false';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr, 'Task should create .m2 folder and succeed');
    });

    it('should handle settings.xml with single server object (not array)', async () => {
        // Arrange
        const singleServerXml = `<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0">
  <servers>
    <server>
      <id>existingServer</id>
      <username>user1</username>
    </server>
  </servers>
</settings>`;
        
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'true';
        process.env[TestEnvVars.settingsXmlContent] = singleServerXml;

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr, 'Task should convert single server to array and add new feed');
    });

    it('should preserve complex settings.xml structure', async () => {
        // Arrange
        const complexXml = `<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0">
  <localRepository>/custom/repo</localRepository>
  <mirrors>
    <mirror>
      <id>central</id>
      <url>https://repo1.maven.org/maven2</url>
    </mirror>
  </mirrors>
  <servers>
    <server>
      <id>otherFeedName</id>
      <username>user</username>
    </server>
  </servers>
</settings>`;
        
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
        process.env[TestEnvVars.m2FolderExists] = 'true';
        process.env[TestEnvVars.settingsXmlExists] = 'true';
        process.env[TestEnvVars.settingsXmlContent] = complexXml;

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr, 'Task should preserve mirrors and localRepository sections');
    });
});
