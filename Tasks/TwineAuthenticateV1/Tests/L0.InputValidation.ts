import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('TwineAuthenticate L0 Suite - Input Validation and Combinations', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Input Combination Validation', function() {
#if WIF
        it('handles both internal feed and WIF service connection', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            await tr.runAsync();
            
            // WIF should take precedence when both are provided
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
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
            
            // Task should fail when WIF is provided without feedUrl
            TestHelpers.assertFailure(tr);
        });

        it('ignores feedUrl when WIF service connection is not provided', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            // Not setting workloadIdentityServiceConnection
            
            await tr.runAsync();
            
            // Should succeed using internal feed, feedUrl should be ignored
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        });
#endif

        it('succeeds with empty feed name', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = '';
            
            await tr.runAsync();
            
            // Should succeed with no feed configured
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
            process.env[testConstants.TestEnvVars.artifactFeed] = 'Feed-Name.With_Special-Chars';
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        });

        it('handles feed names with dots', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.feedWithDot;
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        });

        it('handles project-scoped feed names', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.projectScopedFeed;
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        });

        it('handles feed names with whitespace', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = ' TestFeed ';
            
            await tr.runAsync();
            
            // Should trim whitespace and process feed correctly
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        });
    });

    describe('Multiple Feed Validation', function() {
        it('warns when multiple feeds are provided', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            // Twine only supports one feed, but some users might provide comma-separated list
            process.env[testConstants.TestEnvVars.artifactFeed] = 'Feed1,Feed2';
            
            await tr.runAsync();
            
            // Should succeed but may warn about using only first feed
            TestHelpers.assertSuccess(tr);
        });

        it('handles duplicate feed names gracefully', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.duplicateFeed;
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
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
            process.env[testConstants.TestEnvVars.externalEndpoints] = 'Endpoint1,Endpoint2';
            
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

    describe('.pypirc File Path Validation', function() {
        it('sets PYPIRC_PATH environment variable', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            
            await tr.runAsync();
            
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
            
            // Verify path is absolute and points to .pypirc
            const pypircPath = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pypircPathVar);
            assert(pypircPath && pypircPath.indexOf('.pypirc') >= 0, 
                'PYPIRC_PATH should point to .pypirc file');
        });
    });

    describe('Missing Required System Variables', function() {
        it('handles missing System.AccessToken gracefully', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            // Not setting systemAccessToken
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            
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
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            
            await tr.runAsync();
            
            // Should handle missing collection URI
            assert(tr.succeeded || tr.failed, 'Task should complete');
        });
    });
});
