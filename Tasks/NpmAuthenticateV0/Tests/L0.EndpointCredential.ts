/**
 * L0.EndpointCredential.ts
 *
 * Tests that exercise the REAL resolveServiceEndpointCredential logic
 * (npmrcCredential.ts) through the full task, without mocking it away.
 * Endpoint auth is provided via ENDPOINT_AUTH_* env vars so the task lib
 * reads real auth data. Only the HTTP probe (isEndpointInternal) and
 * external services (packaging location, telemetry) are mocked.
 */

import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars, TestData } from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NpmAuthenticate L0 - Endpoint Credential Resolution', function () {
    this.timeout(20000);

    beforeEach(function () {
        TestHelpers.beforeEach();
    });

    afterEach(function () {
        TestHelpers.afterEach();
    });

    describe('Token auth on external registry', function () {
        it('writes bearer _authToken for an external Token endpoint', async () => {
            // Arrange: external registry with Token auth, probe returns non-Azure DevOps headers
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetupEndpointCredential.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;
            process.env[TestEnvVars.endpointAuthScheme] = 'Token';
            // isInternalEndpoint not set → defaults to false (external)

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNpmrcContains(npmrcPath, `_authToken=${TestData.externalRegistryToken}`);
            TestHelpers.assertNpmrcContains(npmrcPath, 'always-auth=true');
            TestHelpers.assertOutputContains(tr, 'AddingEndpointCredentials');
        });
    });

    describe('Token auth on internal (Azure DevOps) registry', function () {
        it('writes basic auth (username + base64 password) for an internal Token endpoint', async () => {
            // Arrange: probe returns x-tfs/x-vss headers → internal → basic auth
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetupEndpointCredential.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;
            process.env[TestEnvVars.endpointAuthScheme] = 'Token';
            process.env[TestEnvVars.isInternalEndpoint] = 'true';

            // Act
            await tr.runAsync();

            // Assert: internal Token → basic auth with VssToken username + base64 password
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNpmrcContains(npmrcPath, 'username=VssToken');
            TestHelpers.assertNpmrcContains(npmrcPath, '_password=');
            TestHelpers.assertNpmrcContains(npmrcPath, 'always-auth=true');
            // Should NOT have _authToken (that's bearer style)
            TestHelpers.assertNpmrcNotContains(npmrcPath, '_authToken=');
        });
    });

    describe('UsernamePassword auth', function () {
        it('writes basic auth with the provided username and base64 password', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetupEndpointCredential.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.endpointAuthScheme] = 'UsernamePassword';
            process.env[TestEnvVars.endpointUsername] = 'myuser';
            process.env[TestEnvVars.endpointPassword] = 'mypassword';

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNpmrcContains(npmrcPath, 'username=myuser');
            TestHelpers.assertNpmrcContains(npmrcPath, '_password=');
            TestHelpers.assertNpmrcContains(npmrcPath, 'email=myuser');
            TestHelpers.assertNpmrcContains(npmrcPath, 'always-auth=true');
        });
    });

    describe('Telemetry with real credential resolution', function () {
        it('records ExternalFeedAuthCount when endpoint is resolved without mocking', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetupEndpointCredential.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;
            process.env[TestEnvVars.endpointAuthScheme] = 'Token';

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, '"ExternalFeedAuthCount":1');
        });
    });
});
