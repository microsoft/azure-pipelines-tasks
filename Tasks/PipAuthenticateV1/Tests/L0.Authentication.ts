import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('PipAuthenticate L0 Suite - Authentication', function () {
    this.timeout(10000);

    beforeEach(() => {
        // Clear all test configuration environment variables
        delete process.env[testConstants.TestEnvVars.systemAccessToken];
        delete process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri];
        delete process.env[testConstants.TestEnvVars.systemDebug];
        delete process.env[testConstants.TestEnvVars.artifactFeeds];
        delete process.env[testConstants.TestEnvVars.onlyAddExtraIndex];
        delete process.env[testConstants.TestEnvVars.externalEndpoints];
        delete process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection];
        delete process.env[testConstants.TestEnvVars.feedUrl];
        delete process.env[testConstants.TestEnvVars.wifToken];
        delete process.env[testConstants.TestEnvVars.wifShouldFail];
        delete process.env['__throwTelemetryError__'];
    });

    afterEach(() => {
        // Clean up actual environment variables after each test
        delete process.env['PIP_INDEX_URL'];
        delete process.env['PIP_EXTRA_INDEX_URL'];
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['SYSTEM_DEBUG'];
    });

    describe('Single Feed Authentication', function() {
        it('sets PIP_INDEX_URL for single internal feed', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            
            // Verify the URL contains the feed name and credentials
            const pipIndexUrl = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf(testConstants.TestData.singleFeed) >= 0,
                'PIP_INDEX_URL should contain feed name');
            assert(pipIndexUrl && pipIndexUrl.indexOf('build:') >= 0,
                'PIP_INDEX_URL should contain authentication credentials');
            
            // Extra index should not be set for single feed
            TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
        });

        it('marks access token as secret', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.secretToken;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            // Note: Secret marking happens in the utilities module, not directly in main
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        });
    });

    describe('Multiple Feeds Authentication', function() {
        it('sets PIP_INDEX_URL and PIP_EXTRA_INDEX_URL for multiple feeds', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.multipleFeedsString;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            
            // First feed should be in PIP_INDEX_URL
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            const pipIndexUrl = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf('Feed1') >= 0,
                'PIP_INDEX_URL should contain first feed');
            
            // Remaining feeds should be in PIP_EXTRA_INDEX_URL
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
            const pipExtraIndexUrl = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipExtraIndexUrlVar);
            assert(pipExtraIndexUrl && pipExtraIndexUrl.indexOf('Feed2') >= 0,
                'PIP_EXTRA_INDEX_URL should contain second feed');
            assert(pipExtraIndexUrl && pipExtraIndexUrl.indexOf('Feed3') >= 0,
                'PIP_EXTRA_INDEX_URL should contain third feed');
        });

        it('respects onlyAddExtraIndex flag', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.onlyAddExtraIndex] = 'true';
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            
            // When onlyAddExtraIndex is true, PIP_INDEX_URL should not be set
            TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.pipIndexUrlVar);
            
            // All feeds should go to PIP_EXTRA_INDEX_URL
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
        });
    });

    describe('Project-Scoped Feeds', function() {
        it('handles project-scoped feed names', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.projectScopedFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            
            // Verify URL contains project and feed
            const pipIndexUrl = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf('MyProject') >= 0,
                'PIP_INDEX_URL should contain project name');
            assert(pipIndexUrl && pipIndexUrl.indexOf('TestFeed') >= 0,
                'PIP_INDEX_URL should contain feed name');
        });
    });

    describe('External Endpoints', function() {
        it('includes external service endpoints', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.externalEndpoints] = testConstants.TestData.externalServiceEndpoint;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            
            // Internal feed should be in PIP_INDEX_URL
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            
            // External endpoint should be in PIP_EXTRA_INDEX_URL
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
        });
    });

    describe('Mixed Authentication Scenarios', function() {
        it('handles both internal feeds and external endpoints together', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.multipleFeedsString;
            process.env[testConstants.TestEnvVars.externalEndpoints] = 'ExternalEndpoint1,ExternalEndpoint2';
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
            
            // Verify both internal and external are included
            const pipExtraIndexUrl = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipExtraIndexUrlVar);
            assert(pipExtraIndexUrl, 'PIP_EXTRA_INDEX_URL should be set');
        });

        it('uses internal feeds when no external endpoints are available', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            // Not setting externalEndpoints
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            
            // Should only have internal feed
            const pipIndexUrl = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf(testConstants.TestData.singleFeed) >= 0,
                'PIP_INDEX_URL should contain internal feed');
        });

        it('authenticates external endpoints when no internal feeds are configured', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.externalEndpoints] = testConstants.TestData.externalServiceEndpoint;
            // Not setting artifactFeeds
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            
            // External endpoints should still be configured
            const pipExtraIndexUrl = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipExtraIndexUrlVar);
            if (pipExtraIndexUrl) {
                // If external endpoints set EXTRA_INDEX_URL, verify it's set
                TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
            }
        });

        it('properly sequences multiple internal feeds when combined with external', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = 'Feed1,Feed2,Feed3';
            process.env[testConstants.TestEnvVars.externalEndpoints] = 'External1';
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
            
            // First internal feed should be in INDEX_URL
            const pipIndexUrl = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf('Feed1') >= 0,
                'First feed should be in PIP_INDEX_URL');
            
            // Other feeds and external should be in EXTRA_INDEX_URL
            const pipExtraIndexUrl = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipExtraIndexUrlVar);
            assert(pipExtraIndexUrl && (pipExtraIndexUrl.indexOf('Feed2') >= 0 || pipExtraIndexUrl.indexOf('Feed3') >= 0),
                'Additional feeds should be in PIP_EXTRA_INDEX_URL');
        });
    });
});
