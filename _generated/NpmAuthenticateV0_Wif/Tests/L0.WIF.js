"use strict";
// NpmAuthenticate L0 tests - Workload Identity Federation (WIF)
// These tests exercise the #if WIF code paths, which are only compiled into
// the NpmAuthenticateV0_Wif build variant.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const TestConstants_1 = require("./TestConstants");
const TestHelpers_1 = require("./TestHelpers");
describe('NpmAuthenticate L0 - Workload Identity Federation (WIF)', function () {
    this.timeout(20000);
    beforeEach(function () {
        TestHelpers_1.TestHelpers.beforeEach();
    });
    afterEach(function () {
        TestHelpers_1.TestHelpers.afterEach();
    });
    it('authenticates a specific feed via feedUrl + service connection', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange: .npmrc has one registry that matches the feedUrl
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.wifRegistryUrl}`);
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]: TestConstants_1.TestData.wifServiceConnection,
            [TestConstants_1.TestEnvVars.wifRegistryUrl]: TestConstants_1.TestData.wifRegistryUrl,
            [TestConstants_1.TestEnvVars.wifToken]: TestConstants_1.TestData.wifToken
        });
        // Assert
        TestHelpers_1.TestHelpers.assertSuccess(tr);
        TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, TestConstants_1.TestData.wifToken, 'The WIF federated token should be written as the auth token for the registry');
        TestHelpers_1.TestHelpers.assertOutputContains(tr, 'Info_SuccessAddingFederatedFeedAuth');
    }));
    it('fails when feedUrl is not present in the .npmrc file', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange: .npmrc has a different registry, not the one specified as feedUrl
        const differentRegistry = 'https://pkgs.dev.azure.com/testorg/_packaging/OtherFeed/npm/registry/';
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${differentRegistry}`);
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]: TestConstants_1.TestData.wifServiceConnection,
            // feedUrl points to a registry that is NOT in the .npmrc
            [TestConstants_1.TestEnvVars.wifRegistryUrl]: TestConstants_1.TestData.wifRegistryUrl,
            [TestConstants_1.TestEnvVars.wifToken]: TestConstants_1.TestData.wifToken
        });
        // Assert: task must fail because the specified feedUrl has no matching entry in .npmrc
        TestHelpers_1.TestHelpers.assertFailure(tr, 'Task should fail when feedUrl is not matched by any registry in .npmrc');
        TestHelpers_1.TestHelpers.assertOutputContains(tr, 'IgnoringRegistry');
    }));
    it('authenticates all .npmrc registries when no feedUrl is given', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange: two registries in .npmrc, no feedUrl — WIF auth applied to both
        const url1 = 'https://pkgs.dev.azure.com/testorg/_packaging/FeedA/npm/registry/';
        const url2 = 'https://pkgs.dev.azure.com/testorg/_packaging/FeedB/npm/registry/';
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`@scopeA:registry=${url1}\n@scopeB:registry=${url2}`);
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]: TestConstants_1.TestData.wifServiceConnection,
            // No wifRegistryUrl → feedUrl input is not set
            [TestConstants_1.TestEnvVars.wifToken]: TestConstants_1.TestData.wifToken
        });
        // Assert
        TestHelpers_1.TestHelpers.assertSuccess(tr);
        TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, TestConstants_1.TestData.wifToken, 'WIF token should be written for all registries when no feedUrl is specified');
        // Verify both registries got auth
        const appended = TestHelpers_1.TestHelpers.getAppendedAuth(tr, npmrcPath);
        assert_1.default.strictEqual(appended.length, 2, 'auth should be appended for each of the 2 registries');
    }));
    it('fails without writing credentials when any WIF registry is not HTTPS', () => __awaiter(this, void 0, void 0, function* () {
        const httpRegistry = 'http://registry.example.com/npm/';
        const httpsRegistry = 'HTTPS://pkgs.dev.azure.com/testorg/_packaging/HttpsFeed/npm/registry/';
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`@http:registry=${httpRegistry}\n@https:registry=${httpsRegistry}`);
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]: TestConstants_1.TestData.wifServiceConnection,
            [TestConstants_1.TestEnvVars.wifToken]: TestConstants_1.TestData.wifToken
        });
        TestHelpers_1.TestHelpers.assertFailure(tr);
        assert_1.default.deepStrictEqual(TestHelpers_1.TestHelpers.getAppendedAuth(tr, npmrcPath), []);
    }));
    it('rejects HTTP aliases before feedUrl filtering or WIF credential acquisition', () => __awaiter(this, void 0, void 0, function* () {
        const secureRegistry = 'https://pkgs.dev.azure.com/testorg/_packaging/WifFeed/npm/registry/';
        const insecureRegistry = 'http://pkgs.dev.azure.com/testorg/_packaging/OtherFeed/npm/registry/';
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`@secure:registry=${secureRegistry}\n@insecure:registry=${insecureRegistry}`);
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]: TestConstants_1.TestData.wifServiceConnection,
            [TestConstants_1.TestEnvVars.wifRegistryUrl]: secureRegistry,
            [TestConstants_1.TestEnvVars.wifShouldFail]: 'true'
        });
        TestHelpers_1.TestHelpers.assertFailure(tr);
        TestHelpers_1.TestHelpers.assertOutputContains(tr, 'Error_MixedRegistrySchemes');
        assert_1.default.deepStrictEqual(TestHelpers_1.TestHelpers.getAppendedAuth(tr, npmrcPath), []);
    }));
    it('rejects an HTTP registry selected by feedUrl', () => __awaiter(this, void 0, void 0, function* () {
        const httpRegistry = 'http://pkgs.dev.azure.com/testorg/_packaging/HttpFeed/npm/registry/';
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${httpRegistry}`);
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]: TestConstants_1.TestData.wifServiceConnection,
            [TestConstants_1.TestEnvVars.wifRegistryUrl]: httpRegistry,
            [TestConstants_1.TestEnvVars.wifToken]: TestConstants_1.TestData.wifToken
        });
        TestHelpers_1.TestHelpers.assertFailure(tr);
        assert_1.default.deepStrictEqual(TestHelpers_1.TestHelpers.getAppendedAuth(tr, npmrcPath), []);
        TestHelpers_1.TestHelpers.assertOutputNotContains(tr, 'Info_SuccessAddingFederatedFeedAuth');
    }));
    it('rejects a spoofed HTTPS registry before writing the WIF token', () => __awaiter(this, void 0, void 0, function* () {
        const spoofedRegistry = 'https://pkgs.dev.azure.com.attacker.example/feed/npm/registry/';
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${spoofedRegistry}`);
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]: TestConstants_1.TestData.wifServiceConnection,
            [TestConstants_1.TestEnvVars.wifRegistryUrl]: spoofedRegistry,
            [TestConstants_1.TestEnvVars.wifToken]: TestConstants_1.TestData.wifToken
        });
        TestHelpers_1.TestHelpers.assertFailure(tr);
        assert_1.default.deepStrictEqual(TestHelpers_1.TestHelpers.getAppendedAuth(tr, npmrcPath), []);
        TestHelpers_1.TestHelpers.assertOutputContains(tr, 'Error_FeedUrlUntrustedHost');
    }));
    it('logs and skips malformed registries before feedUrl matching', () => __awaiter(this, void 0, void 0, function* () {
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`@invalid:registry=not-a-url\n@valid:registry=${TestConstants_1.TestData.wifRegistryUrl}`);
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]: TestConstants_1.TestData.wifServiceConnection,
            [TestConstants_1.TestEnvVars.wifRegistryUrl]: TestConstants_1.TestData.wifRegistryUrl,
            [TestConstants_1.TestEnvVars.wifToken]: TestConstants_1.TestData.wifToken
        });
        TestHelpers_1.TestHelpers.assertSuccess(tr);
        TestHelpers_1.TestHelpers.assertOutputContains(tr, 'InvalidRegistryUrl');
        assert_1.default.strictEqual(tr.warningIssues.length, 0);
        TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, TestConstants_1.TestData.wifToken);
    }));
    it('fails when feedUrl is provided without a service connection', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange: feedUrl is set but workloadIdentityServiceConnection is not
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.wifRegistryUrl}`);
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.wifRegistryUrl]: TestConstants_1.TestData.wifRegistryUrl
            // workloadIdentityServiceConnection intentionally not set
        });
        // Assert
        TestHelpers_1.TestHelpers.assertFailure(tr, 'Task should fail when feedUrl is set without a WIF service connection');
        TestHelpers_1.TestHelpers.assertOutputContains(tr, 'MissingFeedUrlOrServiceConnection');
    }));
    it('fails when WIF token acquisition fails', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange: service connection is set but getFederatedWorkloadIdentityCredentials throws
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.wifRegistryUrl}`);
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]: TestConstants_1.TestData.wifServiceConnection,
            [TestConstants_1.TestEnvVars.wifRegistryUrl]: TestConstants_1.TestData.wifRegistryUrl,
            [TestConstants_1.TestEnvVars.wifShouldFail]: 'true'
        });
        // Assert
        TestHelpers_1.TestHelpers.assertFailure(tr, 'Task should fail when federated token acquisition throws');
    }));
    describe('feedUrl matching normalization', function () {
        it('matches when feedUrl has no trailing slash but .npmrc does', () => __awaiter(this, void 0, void 0, function* () {
            // feedUrl without slash, .npmrc with slash — should still match
            const registryWithSlash = 'https://pkgs.dev.azure.com/testorg/_packaging/WifFeed/npm/registry/';
            const feedUrlNoSlash = 'https://pkgs.dev.azure.com/testorg/_packaging/WifFeed/npm/registry';
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${registryWithSlash}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
                [TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]: TestConstants_1.TestData.wifServiceConnection,
                [TestConstants_1.TestEnvVars.wifRegistryUrl]: feedUrlNoSlash,
                [TestConstants_1.TestEnvVars.wifToken]: TestConstants_1.TestData.wifToken
            });
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, TestConstants_1.TestData.wifToken);
        }));
        it('matches when feedUrl differs in case from .npmrc', () => __awaiter(this, void 0, void 0, function* () {
            const registryMixedCase = 'https://PKGS.DEV.AZURE.COM/testorg/_packaging/WifFeed/npm/registry/';
            const feedUrlLowerCase = 'https://pkgs.dev.azure.com/testorg/_packaging/WifFeed/npm/registry/';
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${registryMixedCase}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
                [TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]: TestConstants_1.TestData.wifServiceConnection,
                [TestConstants_1.TestEnvVars.wifRegistryUrl]: feedUrlLowerCase,
                [TestConstants_1.TestEnvVars.wifToken]: TestConstants_1.TestData.wifToken
            });
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, TestConstants_1.TestData.wifToken);
        }));
        it('does not match when feedUrl path differs from .npmrc', () => __awaiter(this, void 0, void 0, function* () {
            const npmrcRegistry = 'https://pkgs.dev.azure.com/testorg/_packaging/FeedA/npm/registry/';
            const feedUrlDifferentPath = 'https://pkgs.dev.azure.com/testorg/_packaging/FeedB/npm/registry/';
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${npmrcRegistry}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
                [TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]: TestConstants_1.TestData.wifServiceConnection,
                [TestConstants_1.TestEnvVars.wifRegistryUrl]: feedUrlDifferentPath,
                [TestConstants_1.TestEnvVars.wifToken]: TestConstants_1.TestData.wifToken
            });
            // feedUrl doesn't match any .npmrc entry → task should fail
            TestHelpers_1.TestHelpers.assertFailure(tr, 'Task should fail when feedUrl path does not match any registry');
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'IgnoringRegistry');
        }));
    });
});
