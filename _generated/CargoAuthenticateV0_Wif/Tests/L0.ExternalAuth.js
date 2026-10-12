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
describe('CargoAuthenticate L0 Suite - External Authentication (Service Connections)', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers_1.TestHelpers.beforeEach());
    afterEach(() => TestHelpers_1.TestHelpers.afterEach());
    describe('External Service Connection Authentication', function () {
        it('authenticates registry with matching external service connection', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.forExternalAuth('test-registry', 'ExternalConnection'));
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, 'CARGO_REGISTRIES_TEST_REGISTRY_TOKEN');
            TestHelpers_1.TestHelpers.assertMarkedAsSecret(tr, testConstants.TestData.externalServiceConnectionToken);
            TestHelpers_1.TestHelpers.assertTelemetryEmitted(tr, { ExternalFeedAuthCount: 1 });
        }));
        it('external connection authenticates registry from different Azure DevOps org', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            // Registry in 'externalorg' but collection is 'testorg'
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.forExternalAuth('test-registry', 'ExternalConnection', {
                '__mockConfigContent__': testConstants.TestData.externalAzureDevOpsToml
            }));
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, 'CARGO_REGISTRIES_TEST_REGISTRY_TOKEN');
            TestHelpers_1.TestHelpers.assertMarkedAsSecret(tr, testConstants.TestData.externalServiceConnectionToken);
            TestHelpers_1.TestHelpers.assertTelemetryEmitted(tr, { ExternalFeedAuthCount: 1 });
        }));
        it('external connection takes precedence over System.AccessToken when URL matches', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.forExternalAuth('test-registry', 'ExternalConnection', {
                [testConstants.TestEnvVars.systemAccessToken]: testConstants.TestData.defaultAccessToken
            }));
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, 'CARGO_REGISTRIES_TEST_REGISTRY_TOKEN');
            TestHelpers_1.TestHelpers.assertMarkedAsSecret(tr, testConstants.TestData.externalServiceConnectionToken);
            TestHelpers_1.TestHelpers.assertTelemetryEmitted(tr, { ExternalFeedAuthCount: 1, InternalFeedAuthCount: 0 });
        }));
        it('falls back to System.AccessToken when no external connection URL matches', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.withDefaults({
                '__mockServiceConnections__': JSON.stringify([{
                        authType: 'UsernamePassword',
                        packageSource: {
                            uri: 'https://pkgs.dev.azure.com/differentorg/_packaging/different-feed/Cargo/index/'
                        },
                        username: 'differentorg',
                        password: testConstants.TestData.externalServiceConnectionToken
                    }])
            }));
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, 'CARGO_REGISTRIES_TEST_REGISTRY_TOKEN');
            TestHelpers_1.TestHelpers.assertMarkedAsSecret(tr, testConstants.TestData.defaultAccessToken);
            TestHelpers_1.TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 1, ExternalFeedAuthCount: 0 });
        }));
        it('handles multiple external connections correctly', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.forMixedAuth('internal-registry', 'external-registry', 'ExternalConnection'));
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 1, ExternalFeedAuthCount: 1 });
        }));
    });
    describe('External Authentication Edge Cases', function () {
        it('handles empty service connections array', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.withDefaults({
                '__mockServiceConnections__': JSON.stringify([])
            }));
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, 'CARGO_REGISTRIES_TEST_REGISTRY_TOKEN');
            TestHelpers_1.TestHelpers.assertMarkedAsSecret(tr, testConstants.TestData.defaultAccessToken);
            TestHelpers_1.TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 1 });
        }));
        it('handles unknown service connection auth type', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.withDefaults({
                '__mockServiceConnections__': JSON.stringify([{
                        authType: 'UnknownType',
                        packageSource: {
                            uri: 'https://pkgs.dev.azure.com/testorg/_packaging/test-feed/Cargo/index/'
                        }
                    }])
            }));
            // Assert
            TestHelpers_1.TestHelpers.assertFailure(tr, {
                expectedError: 'Error_InvalidServiceConnection'
            });
        }));
        it('handles malformed service connection without packageSource', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange & Act
            const tr = yield TestHelpers_1.TestHelpers.runTest(TestConstants_1.TestDataBuilder.withDefaults({
                '__mockServiceConnections__': JSON.stringify([{
                        authType: 'UsernamePassword',
                        username: 'test',
                        password: 'test'
                        // Missing packageSource - will cause task to fail
                    }])
            }));
            // Assert
            // Task fails when packageSource is missing (format guaranteed by platform)
            TestHelpers_1.TestHelpers.assertFailure(tr, {
                shouldHaveErrors: true
            });
        }));
    });
});
