"use strict";
// Tests that exercise the real resolveServiceEndpointCredential logic
// (npmrcCredential.ts) via TestSetupEndpointCredential, which provides
// endpoint auth through ENDPOINT_AUTH_* env vars instead of mocking.
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
const TestConstants_1 = require("./TestConstants");
const TestHelpers_1 = require("./TestHelpers");
describe('NpmAuthenticate L0 - Endpoint Credential Resolution', function () {
    this.timeout(20000);
    beforeEach(function () { TestHelpers_1.TestHelpers.beforeEach(); });
    afterEach(function () { TestHelpers_1.TestHelpers.afterEach(); });
    describe('Token auth on external registry', function () {
        it('writes bearer _authToken for an external Token endpoint', () => __awaiter(this, void 0, void 0, function* () {
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.externalRegistryUrl}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
                [TestConstants_1.TestEnvVars.customEndpoint]: TestConstants_1.TestData.externalEndpointId,
                [TestConstants_1.TestEnvVars.externalRegistryUrl]: TestConstants_1.TestData.externalRegistryUrl,
                [TestConstants_1.TestEnvVars.externalRegistryToken]: TestConstants_1.TestData.externalRegistryToken,
                [TestConstants_1.TestEnvVars.endpointAuthScheme]: 'Token'
            }, 'TestSetupEndpointCredential.js');
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, `_authToken=${TestConstants_1.TestData.externalRegistryToken}`);
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, 'always-auth=true');
        }));
    });
    describe('Token auth on internal (Azure DevOps) registry', function () {
        it('writes basic auth for an internal Token endpoint', () => __awaiter(this, void 0, void 0, function* () {
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.externalRegistryUrl}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
                [TestConstants_1.TestEnvVars.customEndpoint]: TestConstants_1.TestData.externalEndpointId,
                [TestConstants_1.TestEnvVars.externalRegistryUrl]: TestConstants_1.TestData.externalRegistryUrl,
                [TestConstants_1.TestEnvVars.externalRegistryToken]: TestConstants_1.TestData.externalRegistryToken,
                [TestConstants_1.TestEnvVars.endpointAuthScheme]: 'Token',
                [TestConstants_1.TestEnvVars.isInternalEndpoint]: 'true'
            }, 'TestSetupEndpointCredential.js');
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, 'username=VssToken');
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, '_password=');
            TestHelpers_1.TestHelpers.assertNpmrcNotContains(npmrcPath, '_authToken=');
        }));
    });
    describe('UsernamePassword auth', function () {
        it('writes basic auth with the provided username', () => __awaiter(this, void 0, void 0, function* () {
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.externalRegistryUrl}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
                [TestConstants_1.TestEnvVars.customEndpoint]: TestConstants_1.TestData.externalEndpointId,
                [TestConstants_1.TestEnvVars.externalRegistryUrl]: TestConstants_1.TestData.externalRegistryUrl,
                [TestConstants_1.TestEnvVars.endpointAuthScheme]: 'UsernamePassword',
                [TestConstants_1.TestEnvVars.endpointUsername]: 'myuser',
                [TestConstants_1.TestEnvVars.endpointPassword]: 'mypassword'
            }, 'TestSetupEndpointCredential.js');
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, 'username=myuser');
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, '_password=');
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, 'email=myuser');
        }));
    });
    describe('Telemetry with real credential resolution', function () {
        it('records ExternalFeedAuthCount', () => __awaiter(this, void 0, void 0, function* () {
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.externalRegistryUrl}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
                [TestConstants_1.TestEnvVars.customEndpoint]: TestConstants_1.TestData.externalEndpointId,
                [TestConstants_1.TestEnvVars.externalRegistryUrl]: TestConstants_1.TestData.externalRegistryUrl,
                [TestConstants_1.TestEnvVars.externalRegistryToken]: TestConstants_1.TestData.externalRegistryToken,
                [TestConstants_1.TestEnvVars.endpointAuthScheme]: 'Token'
            }, 'TestSetupEndpointCredential.js');
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertOutputContains(tr, '"ExternalFeedAuthCount":1');
        }));
    });
});
