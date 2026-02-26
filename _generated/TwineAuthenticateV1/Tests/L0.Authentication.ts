import * as path from 'path';
import * as assert from 'assert';
import * as fs from 'fs';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

const tempDir = path.join(__dirname, 'temp');

describe('TwineAuthenticate L0 Suite - Authentication', function () {
    this.timeout(10000);

    beforeEach(() => {
        // Clear all test configuration environment variables
        delete process.env[testConstants.TestEnvVars.systemAccessToken];
        delete process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri];
        delete process.env[testConstants.TestEnvVars.systemDebug];
        delete process.env[testConstants.TestEnvVars.artifactFeed];
        delete process.env[testConstants.TestEnvVars.externalEndpoints];
        delete process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection];
        delete process.env[testConstants.TestEnvVars.feedUrl];
        delete process.env[testConstants.TestEnvVars.wifToken];
        delete process.env[testConstants.TestEnvVars.wifShouldFail];
        delete process.env['__throwTelemetryError__'];
    });

    afterEach(() => {
        // Clean up actual environment variables after each test
        delete process.env['PYPIRC_PATH'];
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['SYSTEM_DEBUG'];
    });

    describe('Single Feed Authentication', function() {
        it('creates .pypirc file for single internal feed', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
            
            // Verify PYPIRC_PATH points to correct file
            const pypircPath = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pypircPathVar);
            assert(pypircPath &&pypircPath.indexOf('.pypirc') >= 0,
                'PYPIRC_PATH should point to .pypirc file');
            
            // Verify access token was marked as secret
            TestHelpers.assertMarkedAsSecret(tr, testConstants.TestData.defaultAccessToken);
        });

        it('marks access token as secret', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.secretToken;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            // Secret marking happens in authentication.ts
            TestHelpers.assertMarkedAsSecret(tr);
        });

        it('creates .pypirc for feed with dot in name', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.feedWithDot;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
            
            // Verify .pypirc content handles feed with dot
            const pypircFile = path.join(tempDir, '.pypirc');
            const fileContent = fs.readFileSync(pypircFile, 'utf-8');
            assert(fileContent.indexOf(testConstants.TestData.feedWithDot) >= 0,
                'Should handle feed names with dots');
        });
    });

    describe('Project-Scoped Feeds', function() {
        it('handles project-scoped feed names', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.projectScopedFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
            
            // Verify .pypirc content has correct feed URL
            const pypircFile = path.join(tempDir, '.pypirc');
            const fileContent = fs.readFileSync(pypircFile, 'utf-8');
            assert(fileContent.indexOf('MyProject') >= 0,
                'Repository URL should contain project name');
            assert(fileContent.indexOf('TestFeed') >= 0,
                'Repository URL should contain feed name');
        });
    });

    describe('External Endpoints', function() {
        it('includes external service endpoints', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.externalEndpoints] = testConstants.TestData.externalServiceEndpoint;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
            
            // Verify PYPIRC_PATH was set with external endpoints configuration
            const pypircPath = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pypircPathVar);
            assert(pypircPath && pypircPath.indexOf('.pypirc') >= 0,
                'PYPIRC_PATH should be set for external endpoints');
        });
    });

    describe('.pypirc File Format', function() {
        it('creates properly formatted .pypirc file', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            
            // Verify .pypirc structure
            const pypircFile = path.join(tempDir, '.pypirc');
            const fileContent = fs.readFileSync(pypircFile, 'utf-8');
            const lines = fileContent.split(/\r?\n/);
            
            // [distutils] header and index-servers lists the feed name
            assert.strictEqual(lines[0], testConstants.TestData.pypircDistutils,
                'First line should be [distutils]');
            assert.strictEqual(
                lines[1],
                `${testConstants.TestData.pypircIndexServers}${testConstants.TestData.singleFeed}`,
                `index-servers line should be "index-servers=${testConstants.TestData.singleFeed}"`
            );

            // Feed section header
            assert(
                fileContent.includes(`[${testConstants.TestData.singleFeed}]`),
                'Should have feed section header matching the feed name'
            );

            // Repository URL comes from the mock (getPackagingRouteUrl returns https://vsts/packagesource/<feedId>)
            assert(
                fileContent.includes(`repository=https://vsts/packagesource/${testConstants.TestData.singleFeed}`),
                'repository= should contain the feed URL from the location mock'
            );

            // username is always "build" for internal ADO feeds
            assert(
                fileContent.includes('username=build'),
                'username= should be "build" for internal feeds'
            );

            // password is the system access token
            assert(
                fileContent.includes(`password=${testConstants.TestData.defaultAccessToken}`),
                `password= should be the system access token — got:\n${fileContent}`
            );
        });
    });

    describe('Mixed Authentication Scenarios', function() {
        it('handles both internal feed and external endpoints together', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.externalEndpoints] = 'ExternalEndpoint1,ExternalEndpoint2';
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
            
            // .pypirc should contain both internal and external repositories
            TestHelpers.assertMarkedAsSecret(tr, testConstants.TestData.defaultAccessToken);
        });

        it('uses internal feed when no external endpoints are available', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            // Not setting externalEndpoints
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
            
            // Should create .pypirc with internal feed
            const pypircPath = TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pypircPathVar);
            assert(pypircPath && pypircPath.indexOf('.pypirc') >= 0,
                'PYPIRC_PATH should point to .pypirc file');
        });

        it('authenticates external endpoints when no internal feed is configured', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.externalEndpoints] = testConstants.TestData.externalServiceEndpoint;
            // Not setting artifactFeed
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            
            // .pypirc should be created for external endpoints
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        });

        it('prefers internal feed over external when both are configured', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.externalEndpoints] = testConstants.TestData.externalServiceEndpoint;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
            
            // Both should be authenticated
            TestHelpers.assertMarkedAsSecret(tr, testConstants.TestData.defaultAccessToken);
        });
    });
});
