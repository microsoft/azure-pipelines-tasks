import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars, TestData } from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NpmAuthenticate L0 - Authentication (Integration)', function () {
    this.timeout(20000);

    beforeEach(function () {
        TestHelpers.beforeEach();
    });

    afterEach(function () {
        TestHelpers.afterEach();
    });

    describe('Internal feed authentication', function () {
        it('appends auth token for a matching internal registry', async () => {
            // The project .npmrc and the target .npmrc are the same file here.
            // The registry host (dev.azure.com) matches the collectionUri host.
            const internalUrl = `${TestData.collectionUri}_packaging/TestFeed/npm/registry/`;
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${internalUrl}`);
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;

            await tr.runAsync();

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNpmrcContains(npmrcPath, `_authToken=${TestData.systemAccessToken}`);
        });

        it('logs that credentials are being added', async () => {
            const internalUrl = `${TestData.collectionUri}_packaging/TestFeed/npm/registry/`;
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${internalUrl}`);
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;

            await tr.runAsync();

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'AddingLocalCredentials');
        });
    });

    describe('External service connection authentication', function () {
        it('appends auth token for a matching external registry', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;

            await tr.runAsync();

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNpmrcContains(npmrcPath, `_authToken=${TestData.externalRegistryToken}`);
        });

        it('logs that endpoint credentials are being added', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;

            await tr.runAsync();

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'AddingEndpointCredentials');
        });
    });

    describe('Unmatched registry', function () {
        it('ignores registry when no auth source matches', async () => {
            const unmatchedUrl = 'https://registry.npmjs.org/';
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${unmatchedUrl}`);
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;

            await tr.runAsync();

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'IgnoringRegistry');
            TestHelpers.assertNpmrcNotContains(npmrcPath, '_authToken');
        });

        it('succeeds with no auth when .npmrc has no registries', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc('');
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;

            await tr.runAsync();

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNpmrcNotContains(npmrcPath, '_authToken');
        });
    });

    describe('Duplicate endpoint detection', function () {
        it('warns when external endpoint was already registered in a prior task run', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;
            process.env[TestEnvVars.existingEndpoints] = TestData.externalRegistryUrl;

            await tr.runAsync();

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertWarningIssue(tr, 'DuplicateCredentials',
                'Task should warn when the same endpoint is registered twice in the same job');
        });
    });

    describe('Checked-in credentials', function () {
        it('warns and replaces when .npmrc has checked-in credentials', async () => {
            // Arrange: .npmrc has an external registry with pre-existing auth lines
            // (a common user mistake — committing tokens to source control).
            // The task should warn about overriding them and write fresh auth.
            const npmrcContent = [
                `registry=${TestData.externalRegistryUrl}`,
                `//registry.example.com/npm/:_authToken=old-checked-in-token`,
                `//registry.example.com/npm/:always-auth=true`
            ].join('\n');
            const npmrcPath = TestHelpers.createTempNpmrc(npmrcContent);
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            // Fresh token should be written, replacing the checked-in one
            TestHelpers.assertNpmrcContains(npmrcPath, TestData.externalRegistryToken);
        });
    });

    describe('Mixed internal and external registries', function () {
        it('authenticates both internal and external registries in the same .npmrc', async () => {
            // Arrange: .npmrc has two registries — one internal (matches collectionUri host)
            // and one external (resolved via customEndpoint mock)
            const internalUrl = `${TestData.collectionUri}_packaging/InternalFeed/npm/registry/`;
            const npmrcContent = [
                `@internal:registry=${internalUrl}`,
                `@external:registry=${TestData.externalRegistryUrl}`
            ].join('\n');
            const npmrcPath = TestHelpers.createTempNpmrc(npmrcContent);
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);

            process.env[TestEnvVars.npmrcPath] = npmrcPath;
            process.env[TestEnvVars.customEndpoint] = TestData.externalEndpointId;
            process.env[TestEnvVars.externalRegistryUrl] = TestData.externalRegistryUrl;
            process.env[TestEnvVars.externalRegistryToken] = TestData.externalRegistryToken;

            // Act
            await tr.runAsync();

            // Assert
            TestHelpers.assertSuccess(tr);
            // Internal feed should get System.AccessToken
            TestHelpers.assertNpmrcContains(npmrcPath, TestData.systemAccessToken);
            // External feed should get the endpoint token
            TestHelpers.assertNpmrcContains(npmrcPath, TestData.externalRegistryToken);
            // Both credential sources should be logged
            TestHelpers.assertOutputContains(tr, 'AddingLocalCredentials');
            TestHelpers.assertOutputContains(tr, 'AddingEndpointCredentials');
        });
    });
});
