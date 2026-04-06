import { TestEnvVars, TestData } from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NpmAuthenticate L0 - Error Paths', function () {
    this.timeout(20000);

    beforeEach(function () { TestHelpers.beforeEach(); });
    afterEach(function () { TestHelpers.afterEach(); });

    it('fails when packaging location cannot be resolved', async () => {
        const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.internalRegistryUrl}`);

        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.npmrcPath]: npmrcPath,
            [TestEnvVars.packagingLocationShouldFail]: 'true'
        });

        TestHelpers.assertFailure(tr, 'Task should fail when packaging URIs cannot be resolved');
        // Telemetry should still be emitted (finally block)
        TestHelpers.assertOutputContains(tr, `${TestData.telemetryPrefix}Packaging.NpmAuthenticateV0`);
    });

    it('falls back to bearer auth when HTTP probe fails', async () => {
        // When isEndpointInternal throws a network error, the endpoint should
        // be treated as external (bearer _authToken, not basic VssToken)
        const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);

        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.npmrcPath]: npmrcPath,
            [TestEnvVars.customEndpoint]: TestData.externalEndpointId,
            [TestEnvVars.externalRegistryUrl]: TestData.externalRegistryUrl,
            [TestEnvVars.externalRegistryToken]: TestData.externalRegistryToken,
            [TestEnvVars.endpointAuthScheme]: 'Token',
            [TestEnvVars.httpProbeShouldFail]: 'true'
        }, 'TestSetupEndpointCredential.js');

        TestHelpers.assertSuccess(tr);
        // Should use bearer auth (external fallback), not basic auth
        TestHelpers.assertNpmrcContains(npmrcPath, `_authToken=${TestData.externalRegistryToken}`);
        TestHelpers.assertNpmrcNotContains(npmrcPath, 'username=VssToken');
    });

    it('fails when service endpoint is not configured', async () => {
        // customEndpoint references a non-existent endpoint — no ENDPOINT_URL/AUTH env vars
        const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);

        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.npmrcPath]: npmrcPath,
            [TestEnvVars.customEndpoint]: 'NonExistentEndpoint'
            // Deliberately not setting ENDPOINT_URL or ENDPOINT_AUTH for this endpoint
        }, 'TestSetupEndpointCredential.js');

        TestHelpers.assertFailure(tr, 'Task should fail when endpoint is not configured');
    });
});
