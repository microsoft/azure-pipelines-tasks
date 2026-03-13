import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars, TestData } from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NpmAuthenticate L0 - Error Paths', function () {
    this.timeout(20000);

    beforeEach(function () { TestHelpers.beforeEach(); });
    afterEach(function () { TestHelpers.afterEach(); });

    it('fails when packaging location cannot be resolved', async () => {
        const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.internalRegistryUrl}`);
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.npmrcPath] = npmrcPath;
        process.env[TestEnvVars.packagingLocationShouldFail] = 'true';

        await tr.runAsync();

        TestHelpers.assertFailure(tr, 'Task should fail when packaging URIs cannot be resolved');
        // Telemetry should still be emitted (finally block)
        TestHelpers.assertOutputContains(tr, `${TestData.telemetryPrefix}Packaging.NpmAuthenticateV0`);
    });

    it('falls back to bearer auth when HTTP probe fails', async () => {
        // When isEndpointInternal throws a network error, the endpoint should
        // be treated as external (bearer _authToken, not basic VssToken)
        const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
        const tp = path.join(__dirname, 'TestSetupEndpointCredential.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.npmrcPath] = npmrcPath;
        process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
        process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
        process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;
        process.env[TestEnvVars.endpointAuthScheme] = 'Token';
        process.env[TestEnvVars.httpProbeShouldFail] = 'true';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        // Should use bearer auth (external fallback), not basic auth
        TestHelpers.assertNpmrcContains(npmrcPath, `_authToken=${TestData.externalRegistryToken}`);
        TestHelpers.assertNpmrcNotContains(npmrcPath, 'username=VssToken');
    });

    it('fails when service endpoint is not configured', async () => {
        // customEndpoint references a non-existent endpoint — no ENDPOINT_URL/AUTH env vars
        const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
        const tp = path.join(__dirname, 'TestSetupEndpointCredential.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.npmrcPath] = npmrcPath;
        process.env[TestEnvVars.customEndpoint] = 'NonExistentEndpoint';
        // Deliberately not setting ENDPOINT_URL or ENDPOINT_AUTH for this endpoint

        await tr.runAsync();

        TestHelpers.assertFailure(tr, 'Task should fail when endpoint is not configured');
    });
});
