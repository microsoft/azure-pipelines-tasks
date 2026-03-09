// Tests that exercise the real resolveServiceEndpointCredential logic
// (npmrcCredential.ts) via TestSetupEndpointCredential, which provides
// endpoint auth through ENDPOINT_AUTH_* env vars instead of mocking.

import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars, TestData } from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NpmAuthenticate L0 - Endpoint Credential Resolution', function () {
    this.timeout(20000);

    beforeEach(function () { TestHelpers.beforeEach(); });
    afterEach(function () { TestHelpers.afterEach(); });

    describe('Token auth on external registry', function () {
        it('writes bearer _authToken for an external Token endpoint', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetupEndpointCredential.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;
            process.env[TestEnvVars.endpointAuthScheme] = 'Token';

            await tr.runAsync();

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNpmrcContains(npmrcPath, `_authToken=${TestData.externalRegistryToken}`);
            TestHelpers.assertNpmrcContains(npmrcPath, 'always-auth=true');
        });
    });

    describe('Token auth on internal (Azure DevOps) registry', function () {
        it('writes basic auth for an internal Token endpoint', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetupEndpointCredential.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;
            process.env[TestEnvVars.endpointAuthScheme] = 'Token';
            process.env[TestEnvVars.isInternalEndpoint] = 'true';

            await tr.runAsync();

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNpmrcContains(npmrcPath, 'username=VssToken');
            TestHelpers.assertNpmrcContains(npmrcPath, '_password=');
            TestHelpers.assertNpmrcNotContains(npmrcPath, '_authToken=');
        });
    });

    describe('UsernamePassword auth', function () {
        it('writes basic auth with the provided username', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetupEndpointCredential.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.endpointAuthScheme] = 'UsernamePassword';
            process.env[TestEnvVars.endpointUsername] = 'myuser';
            process.env[TestEnvVars.endpointPassword] = 'mypassword';

            await tr.runAsync();

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNpmrcContains(npmrcPath, 'username=myuser');
            TestHelpers.assertNpmrcContains(npmrcPath, '_password=');
            TestHelpers.assertNpmrcContains(npmrcPath, 'email=myuser');
        });
    });

    describe('Telemetry with real credential resolution', function () {
        it('records ExternalFeedAuthCount', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetupEndpointCredential.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;
            process.env[TestEnvVars.endpointAuthScheme] = 'Token';

            await tr.runAsync();

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, '"ExternalFeedAuthCount":1');
        });
    });
});
