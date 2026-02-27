import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars, TestData } from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NpmAuthenticate L0 - Authentication', function () {
    this.timeout(20000);

    beforeEach(function () {
        TestHelpers.beforeEach();
    });

    afterEach(function () {
        TestHelpers.afterEach();
    });

    describe('Internal feed authentication', function () {
        it('appends auth token for a matching internal registry', async () => {
            // Arrange
            const npmrcPath = TestHelpers.createTempNpmrc(
                `registry=${TestData.internalRegistryUrl}\nalways-auth=true`
            );
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            const localRegistry = TestHelpers.buildLocalRegistry(TestData.internalRegistryUrl, 'internal-auth-token-abc');
            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.npmrcRegistries] = TestData.internalRegistryUrl;
            process.env[TestEnvVars.localRegistries] = JSON.stringify([localRegistry]);

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertAuthAppended(tr, 'internal-auth-token-abc');
            TestHelpers.assertNpmrcContains(npmrcPath, '_authToken=internal-auth-token-abc');
        });

        it('appends auth for each registry when multiple internal feeds are listed', async () => {
            // Arrange
            const url1 = 'https://pkgs.dev.azure.com/testorg/_packaging/Feed1/npm/registry/';
            const url2 = 'https://pkgs.dev.azure.com/testorg/_packaging/Feed2/npm/registry/';
            const npmrcPath = TestHelpers.createTempNpmrc(
                `@scope1:registry=${url1}\n@scope2:registry=${url2}`
            );
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            const localReg1 = TestHelpers.buildLocalRegistry(url1, 'token-feed1');
            const localReg2 = TestHelpers.buildLocalRegistry(url2, 'token-feed2');
            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.npmrcRegistries] = [url1, url2].join(';');
            process.env[TestEnvVars.localRegistries] = JSON.stringify([localReg1, localReg2]);

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertAuthAppended(tr, 'token-feed1');
            TestHelpers.assertAuthAppended(tr, 'token-feed2');
            const appended = TestHelpers.getAppendedAuth(tr);
            assert.strictEqual(appended.length, 2, 'appendToNpmrc should be called once per matching registry');
            TestHelpers.assertNpmrcContains(npmrcPath, '_authToken=token-feed1');
            TestHelpers.assertNpmrcContains(npmrcPath, '_authToken=token-feed2');
        });

        it('logs that credentials are being added', async () => {
            // Arrange
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.internalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.npmrcRegistries] = TestData.internalRegistryUrl;
            process.env[TestEnvVars.localRegistries] = JSON.stringify([
                TestHelpers.buildLocalRegistry(TestData.internalRegistryUrl, 'some-token')
            ]);

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'AddingLocalCredentials');
        });
    });

    describe('External service connection authentication', function () {
        it('appends auth token for a matching external registry', async () => {
            // Arrange
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.npmrcRegistries] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;
            // No local registries — the external endpoint is the only auth source

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertAuthAppended(tr, TestData.externalRegistryToken);
            TestHelpers.assertNpmrcContains(npmrcPath, `_authToken=${TestData.externalRegistryToken}`);
        });

        it('logs that endpoint credentials are being added', async () => {
            // Arrange
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.npmrcRegistries] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'AddingEndpointCredentials');
        });
    });

    describe('Unmatched registry', function () {
        it('ignores registry when no auth source matches', async () => {
            // Arrange: .npmrc has a registry that has no matching local or external auth source
            const unmatchedUrl = 'https://registry.npmjs.org/';
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${unmatchedUrl}`);
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.npmrcRegistries] = unmatchedUrl;
            // No localRegistries, no customEndpoint — nothing matches

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNoAuthAppended(tr, 'appendToNpmrc should not be called for unmatched registry');
            TestHelpers.assertOutputContains(tr, 'IgnoringRegistry');
            TestHelpers.assertNpmrcNotContains(npmrcPath, '_authToken');
        });

        it('succeeds with no auth when .npmrc has no registries', async () => {
            // Arrange: completely empty .npmrc
            const npmrcPath = TestHelpers.createTempNpmrc('');
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            // npmrcRegistries not set → mock returns empty list

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNoAuthAppended(tr);
            TestHelpers.assertNpmrcNotContains(npmrcPath, '_authToken');
        });
    });

    describe('Duplicate endpoint detection', function () {
        it('warns when external endpoint was already registered in a prior task run', async () => {
            // Arrange: EXISTING_ENDPOINTS already contains the external registry URL,
            // simulating a previous NpmAuthenticate task run in the same pipeline job.
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.npmrcRegistries] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;
            // Seed the already-seen endpoints list so the task sees a duplicate
            process.env[TestEnvVars.existingEndpoints] = TestData.externalRegistryUrl;

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertWarningIssue(tr, 'DuplicateCredentials',
                'Task should warn when the same endpoint is registered twice in the same job');
        });
    });
});
