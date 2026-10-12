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
const fs = require("fs");
const ttm = require("azure-pipelines-task-lib/mock-test");
const testConstants = require("./TestConstants");
const TestHelpers_1 = require("./TestHelpers");
const tempDir = path.join(__dirname, 'temp');
describe('TwineAuthenticate L0 Suite - Workload Identity Federation', function () {
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
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
            // Verify WIF credentials in .pypirc
            const pypircFile = path.join(tempDir, '.pypirc');
            const fileContent = fs.readFileSync(pypircFile, 'utf-8');
            assert(fileContent.indexOf(testConstants.TestData.wifServiceConnection) >= 0, '.pypirc should contain WIF service connection name');
            assert(fileContent.indexOf(testConstants.TestData.wifToken) >= 0, '.pypirc should contain WIF token');
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'Mock WIF: getFederatedWorkloadIdentityCredentialsForFeed', 'Should call WIF authentication method');
        }));
        it('creates .pypirc with WIF credentials', () => __awaiter(this, void 0, void 0, function* () {
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
            // Verify .pypirc format
            const pypircFile = path.join(tempDir, '.pypirc');
            const fileContent = fs.readFileSync(pypircFile, 'utf-8');
            assert(fileContent.indexOf('[distutils]') >= 0, 'Should have [distutils] section');
            assert(fileContent.indexOf('repository=') >= 0, 'Should have repository field');
            assert(fileContent.indexOf(`username=${testConstants.TestData.wifServiceConnection}`) >= 0, 'Username should be WIF service connection name');
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
        it('fails when only service connection is provided without feed URL', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            // Intentionally not setting feedUrl
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertFailure(tr);
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'Both feed url and service connection need to be set', 'Should fail when feed URL is missing');
        }));
        it('fails when only feed URL is provided without service connection', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.wifFeedUrl;
            // Intentionally not setting workloadIdentityServiceConnection
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertFailure(tr);
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'Both feed url and service connection need to be set', 'Should fail when service connection is missing');
        }));
    });
});
