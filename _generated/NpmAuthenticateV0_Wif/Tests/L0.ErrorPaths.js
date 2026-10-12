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
const TestConstants_1 = require("./TestConstants");
const TestHelpers_1 = require("./TestHelpers");
describe('NpmAuthenticate L0 - Error Paths', function () {
    this.timeout(20000);
    beforeEach(function () { TestHelpers_1.TestHelpers.beforeEach(); });
    afterEach(function () { TestHelpers_1.TestHelpers.afterEach(); });
    it('fails when packaging location cannot be resolved', () => __awaiter(this, void 0, void 0, function* () {
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.internalRegistryUrl}`);
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.packagingLocationShouldFail]: 'true'
        });
        TestHelpers_1.TestHelpers.assertFailure(tr, 'Task should fail when packaging URIs cannot be resolved');
        // Telemetry should still be emitted (finally block)
        TestHelpers_1.TestHelpers.assertOutputContains(tr, `${TestConstants_1.TestData.telemetryPrefix}Packaging.NpmAuthenticateV0`);
    }));
    it('falls back to bearer auth when HTTP probe fails', () => __awaiter(this, void 0, void 0, function* () {
        // When isEndpointInternal throws a network error, the endpoint should
        // be treated as external (bearer _authToken, not basic VssToken)
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.externalRegistryUrl}`);
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.customEndpoint]: TestConstants_1.TestData.externalEndpointId,
            [TestConstants_1.TestEnvVars.externalRegistryUrl]: TestConstants_1.TestData.externalRegistryUrl,
            [TestConstants_1.TestEnvVars.externalRegistryToken]: TestConstants_1.TestData.externalRegistryToken,
            [TestConstants_1.TestEnvVars.endpointAuthScheme]: 'Token',
            [TestConstants_1.TestEnvVars.httpProbeShouldFail]: 'true'
        }, 'TestSetupEndpointCredential.js');
        TestHelpers_1.TestHelpers.assertSuccess(tr);
        // Should use bearer auth (external fallback), not basic auth
        TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, `_authToken=${TestConstants_1.TestData.externalRegistryToken}`);
        TestHelpers_1.TestHelpers.assertNpmrcNotContains(npmrcPath, 'username=VssToken');
    }));
    it('fails when service endpoint is not configured', () => __awaiter(this, void 0, void 0, function* () {
        // customEndpoint references a non-existent endpoint — no ENDPOINT_URL/AUTH env vars
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.externalRegistryUrl}`);
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.customEndpoint]: 'NonExistentEndpoint'
            // Deliberately not setting ENDPOINT_URL or ENDPOINT_AUTH for this endpoint
        }, 'TestSetupEndpointCredential.js');
        TestHelpers_1.TestHelpers.assertFailure(tr, 'Task should fail when endpoint is not configured');
    }));
});
