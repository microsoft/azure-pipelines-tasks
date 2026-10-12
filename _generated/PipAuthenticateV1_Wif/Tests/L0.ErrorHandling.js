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
const ttm = require("azure-pipelines-task-lib/mock-test");
const testConstants = require("./TestConstants");
const TestHelpers_1 = require("./TestHelpers");
describe('PipAuthenticate L0 Suite - Error Handling', function () {
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
    describe('Missing Inputs', function () {
        it('succeeds with no feeds configured', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            // Intentionally not setting artifactFeeds
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr, 'Task should succeed with no feeds configured');
            // No environment variables should be set
            TestHelpers_1.TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.pipIndexUrlVar);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
        }));
        it('handles missing System.AccessToken gracefully', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            // Intentionally not setting systemAccessToken
            // Act
            yield tr.runAsync();
            // Assert
            // Task should succeed - missing token is a pipeline configuration issue, not a task error
            TestHelpers_1.TestHelpers.assertSuccess(tr, 'Task should succeed even without System.AccessToken');
        }));
    });
    describe('Variable Length Limits', function () {
        it('warns when PIP_EXTRA_INDEX_URL is truncated', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            // Create a very long list of feeds that will exceed variable limits
            const manyFeeds = Array.from({ length: 50 }, (_, i) => `Feed${i}`).join(',');
            process.env[testConstants.TestEnvVars.artifactFeeds] = manyFeeds;
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
            // Should warn about variable truncation when there are too many feeds
            // The warning message contains text about PIP_EXTRA_INDEX_URL being truncated
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'PIP_EXTRA_INDEX_URL', 'Should reference PIP_EXTRA_INDEX_URL in warning about too many feed entries');
        }));
    });
});
