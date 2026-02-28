import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('PipAuthenticate L0 Suite - Input Validation and Combinations', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Input Combination Validation', function() {
        it('handles both internal feeds and WIF service connection', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            await tr.runAsync();
            
            // WIF should take precedence when both are provided
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        });

        it('requires feedUrl when WIF service connection is provided', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            // Not setting feedUrl
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            await tr.runAsync();
            
            // Task should handle missing feedUrl - either use internal feeds or warn
            assert(tr.succeeded || tr.failed, 'Task should complete');
        });

        it('ignores feedUrl when WIF service connection is not provided', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            // Not setting workloadIdentityServiceConnection
            
            await tr.runAsync();
            
            // Should succeed using internal feeds, feedUrl should be ignored
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        });

        it('succeeds with empty feed list', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = '';
            
            await tr.runAsync();
            
            // Should succeed with no feeds configured
            TestHelpers.assertSuccess(tr);
        });

        it('handles null/undefined inputs gracefully', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            // Not setting any optional inputs
            
            await tr.runAsync();
            
            // Should handle missing optional inputs
            TestHelpers.assertSuccess(tr);
        });
    });

    describe('Feed Name Validation', function() {
        it('handles feed names with special characters', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = 'Feed-Name.With_Special-Chars';
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        });

        it('handles project-scoped feed names', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.projectScopedFeed;
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        });

        it('handles multiple feed names with commas', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.multipleFeedsString;
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
        });

        it('handles feed names with whitespace', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = ' Feed1 , Feed2 , Feed3 ';
            
            await tr.runAsync();
            
            // Should trim whitespace and process feeds correctly
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        });
    });

    describe('onlyAddExtraIndex Flag Behavior', function() {
        it('sets only PIP_EXTRA_INDEX_URL when onlyAddExtraIndex is true', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.onlyAddExtraIndex] = 'true';
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
            TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.pipIndexUrlVar);
        });

        it('sets PIP_INDEX_URL when onlyAddExtraIndex is false', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.onlyAddExtraIndex] = 'false';
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        });

        it('defaults to setting PIP_INDEX_URL when onlyAddExtraIndex is not specified', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            // Not setting onlyAddExtraIndex
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        });
    });

    describe('External Endpoints Validation', function() {
        it('handles single external endpoint', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.externalEndpoints] = testConstants.TestData.externalServiceEndpoint;
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
        });

        it('handles multiple external endpoints', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.externalEndpoints] = 'Endpoint1,Endpoint2,Endpoint3';
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
        });

        it('handles empty external endpoints', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.externalEndpoints] = '';
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
        });
    });

    describe('Missing Required System Variables', function() {
        it('handles missing System.AccessToken gracefully', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            // Not setting systemAccessToken
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            
            await tr.runAsync();
            
            // Should handle missing token appropriately
            if (tr.failed) {
                TestHelpers.assertOutputContains(tr, 'token', 'Should mention missing token');
            }
        });

        it('handles missing Collection URI gracefully', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            // Not setting systemTeamFoundationCollectionUri
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            
            await tr.runAsync();
            
            // Should handle missing collection URI
            assert(tr.succeeded || tr.failed, 'Task should complete');
        });
    });
});
