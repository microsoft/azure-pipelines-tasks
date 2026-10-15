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
describe('PipAuthenticate L0 Suite - Workload Identity Federation', function () {
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
    describe('WIF Authentication', function () {
        it('authenticates using workload identity federation', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            // Verify WIF credentials are used
            const pipIndexUrl = TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf(testConstants.TestData.wifServiceConnection) >= 0, 'PIP_INDEX_URL should contain WIF service connection name as username');
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'Mock WIF: getFederatedWorkloadIdentityCredentialsForFeed', 'Should call WIF authentication method');
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'Successfully added auth for feed', 'Should log message about successfully adding federated feed auth');
        }));
        it('emits telemetry for WIF authentication', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'Telemetry emitted:', 'Should emit telemetry for WIF authentication');
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'FederatedFeedAuthCount', 'Telemetry should include federated feed auth count');
        }));
    });
    describe('WIF Error Handling', function () {
        it('fails when WIF authentication fails', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            process.env[testConstants.TestEnvVars.wifShouldFail] = 'true';
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertFailure(tr);
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'Failed to add authentication', 'Should show generic error message when WIF throws exception');
        }));
        it('fails when WIF returns null token', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            // Intentionally not setting wifToken - will return undefined
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertFailure(tr);
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'Unable to get federated credentials from service connection', 'Should fail when WIF returns null/undefined token');
        }));
    });
});
