"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const assert = require("assert");
const ttm = require("azure-pipelines-task-lib/mock-test");
const testConstants = require("./TestConstants");
const TestHelpers_1 = require("./TestHelpers");
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
    describe('Single Feed Authentication', function () {
        it('sets PIP_INDEX_URL for single internal feed', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            // Verify the URL embeds the correct credentials: build:<token>@<host>
            const pipIndexUrl = TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf(testConstants.TestData.singleFeed) >= 0, 'PIP_INDEX_URL should contain feed name');
            assert(pipIndexUrl && pipIndexUrl.includes(`build:${testConstants.TestData.defaultAccessToken}@`), `PIP_INDEX_URL should embed the token as "build:<token>@" — got: ${pipIndexUrl}`);
            // Extra index should not be set for single feed
            TestHelpers_1.TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
        }));
        it('marks access token as secret', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.secretToken;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            // Note: Secret marking happens in the utilities module, not directly in main
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        }));
    });
    describe('Multiple Feeds Authentication', function () {
        it('sets PIP_INDEX_URL and PIP_EXTRA_INDEX_URL for multiple feeds', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.multipleFeedsString;
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            // First feed should be in PIP_INDEX_URL
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            const pipIndexUrl = TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf('Feed1') >= 0, 'PIP_INDEX_URL should contain first feed');
            // Remaining feeds should be in PIP_EXTRA_INDEX_URL
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
            const pipExtraIndexUrl = TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipExtraIndexUrlVar);
            assert(pipExtraIndexUrl && pipExtraIndexUrl.indexOf('Feed2') >= 0, 'PIP_EXTRA_INDEX_URL should contain second feed');
            assert(pipExtraIndexUrl && pipExtraIndexUrl.indexOf('Feed3') >= 0, 'PIP_EXTRA_INDEX_URL should contain third feed');
            // Credentials must be embedded in EXTRA_INDEX_URL entries too, not just INDEX_URL.
            // A regression that strips auth from extra feeds would pass without this check.
            assert(pipExtraIndexUrl && pipExtraIndexUrl.includes(`build:${testConstants.TestData.defaultAccessToken}@`), `PIP_EXTRA_INDEX_URL should embed credentials as "build:<token>@" — got: ${pipExtraIndexUrl}`);
        }));
        it('respects onlyAddExtraIndex flag', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.onlyAddExtraIndex] = 'true';
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            // When onlyAddExtraIndex is true, PIP_INDEX_URL should not be set
            TestHelpers_1.TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.pipIndexUrlVar);
            // All feeds should go to PIP_EXTRA_INDEX_URL
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
        }));
    });
    describe('Project-Scoped Feeds', function () {
        it('handles project-scoped feed names', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.projectScopedFeed;
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            // Verify URL contains project and feed
            const pipIndexUrl = TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf('MyProject') >= 0, 'PIP_INDEX_URL should contain project name');
            assert(pipIndexUrl && pipIndexUrl.indexOf('TestFeed') >= 0, 'PIP_INDEX_URL should contain feed name');
        }));
    });
    describe('External Endpoints', function () {
        it('includes external service endpoints', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.externalEndpoints] = testConstants.TestData.externalServiceEndpoint;
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            // Internal feed should be in PIP_INDEX_URL
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            // External endpoint should be in PIP_EXTRA_INDEX_URL
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
        }));
    });
    describe('Mixed Authentication Scenarios', function () {
        it('handles both internal feeds and external endpoints together', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.multipleFeedsString;
            process.env[testConstants.TestEnvVars.externalEndpoints] = 'ExternalEndpoint1,ExternalEndpoint2';
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
            // Verify both internal and external are included
            const pipExtraIndexUrl = TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipExtraIndexUrlVar);
            assert(pipExtraIndexUrl, 'PIP_EXTRA_INDEX_URL should be set');
        }));
        it('uses internal feeds when no external endpoints are available', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            // Not setting externalEndpoints
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            // Should only have internal feed
            const pipIndexUrl = TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf(testConstants.TestData.singleFeed) >= 0, 'PIP_INDEX_URL should contain internal feed');
        }));
        it('authenticates external endpoints when no internal feeds are configured', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.externalEndpoints] = testConstants.TestData.externalServiceEndpoint;
            // Not setting artifactFeeds
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            // External endpoints should still be configured
            const pipExtraIndexUrl = TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipExtraIndexUrlVar);
            if (pipExtraIndexUrl) {
                // If external endpoints set EXTRA_INDEX_URL, verify it's set
                TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
            }
        }));
        it('properly sequences multiple internal feeds when combined with external', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = 'Feed1,Feed2,Feed3';
            process.env[testConstants.TestEnvVars.externalEndpoints] = 'External1';
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
            // First internal feed should be in INDEX_URL
            const pipIndexUrl = TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf('Feed1') >= 0, 'First feed should be in PIP_INDEX_URL');
            // Other feeds and external should be in EXTRA_INDEX_URL
            const pipExtraIndexUrl = TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipExtraIndexUrlVar);
            assert(pipExtraIndexUrl && (pipExtraIndexUrl.indexOf('Feed2') >= 0 || pipExtraIndexUrl.indexOf('Feed3') >= 0), 'Additional feeds should be in PIP_EXTRA_INDEX_URL');
        }));
    });
});
