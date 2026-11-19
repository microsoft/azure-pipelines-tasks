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

    describe('home directory resolution', function () {
        const overriddenHome = path.join(__dirname, 'overriddenhome');
        const testHome = path.join(__dirname, 'testhome');

        beforeEach(function () {
            // The fallback home must exist so the task can inspect it.
            fs.mkdirSync(testHome, { recursive: true });
        });

        afterEach(function () {
            fs.rmSync(overriddenHome, { recursive: true, force: true });
            delete process.env['AGENT_WORKFOLDER'];
        });

        it('should ignore a HOME/USERPROFILE override and write settings.xml to the account home', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
            process.env[TestEnvVars.homeEnvOverride] = overriddenHome;

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            assert(
                fs.existsSync(TestHelpers.getSettingsXmlPath()),
                'settings.xml must be written under the account home'
            );
            assert(
                !fs.existsSync(path.join(overriddenHome, '.m2', 'settings.xml')),
                'settings.xml must not be written under the overridden HOME/USERPROFILE'
            );
            TestHelpers.assertWarningLogged(tr, 'Warning_HomeEnvVarIgnored');
        });

        it('should not warn when HOME/USERPROFILE matches the account home', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputDoesNotContain(tr, 'Warning_HomeEnvVarIgnored');
        });

        it('should fall back to the environment home with a warning when the account home is unavailable', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
            process.env[TestEnvVars.userInfoShouldFail] = 'true';

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertWarningLogged(tr, 'Warning_AccountHomeLookupFailed');
            assert(
                fs.existsSync(TestHelpers.getSettingsXmlPath()),
                'settings.xml should be written under the environment home'
            );
        });

        it('should fall back to the environment home with a warning when the account home is "/"', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
            process.env[TestEnvVars.accountHomeDir] = '/';

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertWarningLogged(tr, 'Warning_AccountHomeUnusable');
            TestHelpers.assertOutputDoesNotContain(tr, 'Warning_HomeEnvVarIgnored');
            assert(
                fs.existsSync(TestHelpers.getSettingsXmlPath()),
                'settings.xml should be written under the environment home'
            );
        });

        it('should not write credentials to a fallback home inside an agent folder', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
            process.env[TestEnvVars.userInfoShouldFail] = 'true';
            process.env['AGENT_WORKFOLDER'] = __dirname;

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertFailure(tr);
            TestHelpers.assertOutputContains(tr, 'Error_FallbackHomeInAgentFolder');
            assert(!fs.existsSync(TestHelpers.getSettingsXmlPath()), 'settings.xml must not be written');
        });

        it('should not write credentials to a fallback home that aliases an agent folder', async () => {
            // Arrange
            const agentWorkFolder = path.join(__dirname, 'agentwork');
            fs.mkdirSync(agentWorkFolder, { recursive: true });
            fs.mkdirSync(overriddenHome, { recursive: true });
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
            process.env[TestEnvVars.osType] = 'Linux';
            process.env[TestEnvVars.userInfoShouldFail] = 'true';
            process.env[TestEnvVars.homeEnvOverride] = overriddenHome;
            process.env[TestEnvVars.directoryAlias] = fs.realpathSync(overriddenHome);
            process.env[TestEnvVars.directoryAliasTarget] = agentWorkFolder;
            process.env['AGENT_WORKFOLDER'] = agentWorkFolder;

            try {
                // Act
                await tr.runAsync();

                // Assert
                TestHelpers.assertFailure(tr);
                TestHelpers.assertOutputContains(tr, 'Error_FallbackHomeInAgentFolder');
                assert(!fs.existsSync(path.join(overriddenHome, '.m2', 'settings.xml')), 'settings.xml must not be written');
            } finally {
                fs.rmSync(agentWorkFolder, { recursive: true, force: true });
            }
        });

        describe('on POSIX file systems', function () {
            before(function () {
                if (process.platform === 'win32') {
                    this.skip();
                }
            });

            it('should not write credentials to a fallback home writable by other users', async () => {
                // Arrange
                fs.mkdirSync(overriddenHome, { recursive: true });
                fs.chmodSync(overriddenHome, 0o777);
                const tp = path.join(__dirname, 'TestSetup.js');
                const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
                process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
                process.env[TestEnvVars.osType] = 'Linux';
                process.env[TestEnvVars.userInfoShouldFail] = 'true';
                process.env[TestEnvVars.homeEnvOverride] = overriddenHome;

                // Act
                await tr.runAsync();

                // Assert
                TestHelpers.assertFailure(tr);
                TestHelpers.assertOutputContains(tr, 'Error_FallbackHomeWritableByOthers');
                assert(!fs.existsSync(path.join(overriddenHome, '.m2', 'settings.xml')), 'settings.xml must not be written');
            });

            it('should not follow a symlinked .m2 under the fallback home', async () => {
                // Arrange
                const symlinkTarget = path.join(__dirname, 'workspace-m2');
                fs.mkdirSync(symlinkTarget, { recursive: true });
                fs.mkdirSync(overriddenHome, { recursive: true });
                fs.chmodSync(overriddenHome, 0o700);
                fs.symlinkSync(symlinkTarget, path.join(overriddenHome, '.m2'));
                const tp = path.join(__dirname, 'TestSetup.js');
                const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
                process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
                process.env[TestEnvVars.osType] = 'Linux';
                process.env[TestEnvVars.userInfoShouldFail] = 'true';
                process.env[TestEnvVars.homeEnvOverride] = overriddenHome;

                try {
                    // Act
                    await tr.runAsync();

                    // Assert
                    TestHelpers.assertFailure(tr);
                    TestHelpers.assertOutputContains(tr, 'Error_FallbackHomeSymlink');
                    assert(!fs.existsSync(path.join(symlinkTarget, 'settings.xml')), 'settings.xml must not be written through the symlink');
                } finally {
                    fs.rmSync(symlinkTarget, { recursive: true, force: true });
                }
            });

            it('should write to a private fallback home and warn about older Java versions', async () => {
                // Arrange
                fs.mkdirSync(overriddenHome, { recursive: true });
                fs.chmodSync(overriddenHome, 0o700);
                const tp = path.join(__dirname, 'TestSetup.js');
                const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
                process.env[TestEnvVars.artifactsFeeds] = TestConstants.feeds.feedName1;
                process.env[TestEnvVars.osType] = 'Linux';
                process.env[TestEnvVars.userInfoShouldFail] = 'true';
                process.env[TestEnvVars.homeEnvOverride] = overriddenHome;

                // Act
                await tr.runAsync();

                // Assert
                TestHelpers.assertSuccess(tr);
                TestHelpers.assertWarningLogged(tr, 'Warning_FallbackHomeJavaCompat');
                assert(fs.existsSync(path.join(overriddenHome, '.m2', 'settings.xml')), 'settings.xml should be written under the fallback home');
            });
        });
    });
});
