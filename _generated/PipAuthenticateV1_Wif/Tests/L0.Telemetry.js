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
describe('PipAuthenticate L0 Suite - Telemetry & Logging', function () {
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
    describe('Telemetry Emission', function () {
        it('emits telemetry on successful authentication', () => __awaiter(this, void 0, void 0, function* () {
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
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'Telemetry emitted:', 'Should emit telemetry on successful authentication');
            TestHelpers_1.TestHelpers.assertOutputContains(tr, testConstants.TestData.telemetryArea, 'Telemetry should include correct area');
            TestHelpers_1.TestHelpers.assertOutputContains(tr, testConstants.TestData.telemetryFeature, 'Telemetry should include correct feature name');
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'InternalFeedAuthCount', 'Telemetry should include internal feed count');
        }));
        it('includes correct feed counts in telemetry', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.multipleFeedsString;
            process.env[testConstants.TestEnvVars.externalEndpoints] = testConstants.TestData.externalServiceEndpoint;
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'InternalFeedAuthCount', 'Telemetry should track internal feed count');
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'ExternalFeedAuthCount', 'Telemetry should track external feed count');
        }));
        it('handles telemetry error appropriately', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.throwTelemetryError] = 'true';
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertFailure(tr);
        }));
    });
    describe('Debug Logging', function () {
        it('logs debug messages when SYSTEM_DEBUG is enabled', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemDebug] = 'true';
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            // Act
            yield tr.runAsync();
            // Assert
            assert(tr.succeeded, 'Task should succeed with debug enabled');
            assert(tr.stdout.indexOf('##vso[task.debug]') >= 0, 'Should log debug messages when SYSTEM_DEBUG is enabled');
        }));
        it('logs informational messages about authentication success', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.multipleFeedsString;
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            // Verify environment variables are set
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
            // Verify informational message about successful authentication
            // Message format: "Successfully added auth for X internal feeds and Y external endpoint."
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'Successfully added auth', 'Should log informational message about successful authentication');
        }));
    });
});
