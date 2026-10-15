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
const testConstants = require("./TestConstants");
const TestHelpers_1 = require("./TestHelpers");
const TestConstants_1 = require("./TestConstants");
describe('CargoAuthenticate L0 Suite - Internal Authentication (System.AccessToken)', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers_1.TestHelpers.beforeEach());
    afterEach(() => TestHelpers_1.TestHelpers.afterEach());
    describe('Basic System.AccessToken Authentication', function () {
        it('authenticates internal registry with System.AccessToken', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.forInternalAuth());
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.expectedTokenVar);
        }));
        it('marks access token as secret', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.forInternalAuth('test-registry', {
                [testConstants.TestEnvVars.systemAccessToken]: testConstants.TestData.secretToken
            }));
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.expectedTokenVar);
            TestHelpers_1.TestHelpers.assertMarkedAsSecret(tr, testConstants.TestData.secretToken);
        }));
        it('handles multiple registries in same organization', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.withDefaults({
                '__mockConfigContent__': testConstants.TestData.multiRegistryTomlContent
            }));
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 2 });
        }));
    });
    describe('Internal Authentication Edge Cases', function () {
        it('handles missing System.AccessToken', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            const tr = yield TestHelpers_1.TestHelpers.runTest({
                [testConstants.TestEnvVars.configFilePath]: testConstants.TestData.validConfigFile,
                '__mockConfigContent__': testConstants.TestData.validTomlContent
                // Intentionally not setting systemAccessToken
            });
            // Assert
            // Task may succeed with empty token or handle gracefully
            TestHelpers_1.TestHelpers.assertSuccess(tr);
        }));
        it('skips registries with URLs not in allowed hosts', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.withDefaults({
                '__mockConfigContent__': testConstants.TestData.externalRegistryToml
            }));
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertStdoutContains(tr, 'loc_mock_SkippingNonAzureDevOpsRegistry');
            TestHelpers_1.TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 0 });
        }));
        it('does not expose System.AccessToken to an HTTP registry on an allowed host', () => __awaiter(this, void 0, void 0, function* () {
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.withDefaults({
                '__mockConfigContent__': `
[registries]
test-registry = { index = "sparse+http://pkgs.dev.azure.com/testorg/_packaging/test-feed/Cargo/index/" }
`
            }));
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.expectedTokenVar);
            TestHelpers_1.TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 0 });
        }));
        it('fails when an ADO registry shares a Cargo environment key with another registry', () => __awaiter(this, void 0, void 0, function* () {
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.withDefaults({
                '__mockConfigContent__': testConstants.TestData.collidingRegistryToml
            }));
            TestHelpers_1.TestHelpers.assertFailure(tr, {
                expectedError: 'loc_mock_RegistryEnvKeyCollision'
            });
            TestHelpers_1.TestHelpers.assertStdoutContains(tr, 'CARGO_REGISTRIES_TEST_REGISTRY_TOKEN');
        }));
        it('uses ASCII uppercase when computing the Cargo environment key', () => __awaiter(this, void 0, void 0, function* () {
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.forInternalAuth('i-registry'));
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, 'CARGO_REGISTRIES_I_REGISTRY_TOKEN');
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, 'CARGO_REGISTRIES_I_REGISTRY_TOKEN');
        }));
        it('handles packaging location service failure gracefully', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.forInternalAuth('test-registry', {
                '__packagingLocationShouldFail__': 'true'
            }));
            // Assert
            TestHelpers_1.TestHelpers.assertFailure(tr, {
                expectedError: 'Unable to get packaging URIs'
            });
        }));
    });
    describe('Overwrite Protection', function () {
        it('skips already-authenticated registry', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            // Pre-set the environment variable before test
            process.env['CARGO_REGISTRIES_TEST_REGISTRY_TOKEN'] = 'already-set-token';
            // Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.forInternalAuth('test-registry', {
                '__mockConfigContent__': testConstants.TestData.preAuthenticatedToml
            }));
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertStdoutContains(tr, 'loc_mock_ConnectionAlreadySet', 'Should warn when registry already has credentials');
            TestHelpers_1.TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 0 });
        }));
        it('logs when registry authentication is skipped due to existing credentials', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            // Pre-set the environment variable before test
            process.env['CARGO_REGISTRIES_TEST_REGISTRY_TOKEN'] = 'already-set-token';
            // Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.forInternalAuth('test-registry', {
                '__mockConfigContent__': testConstants.TestData.preAuthenticatedToml
            }));
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertStdoutContains(tr, 'loc_mock_ConnectionAlreadySet', 'Should warn when registry already has credentials');
        }));
    });
});
