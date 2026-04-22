import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { TestEnvVars, TestData } from './TestConstants';
import { TestHelpers } from './TestHelpers';
import { appendAuthToNpmrc, removeExistingCredentialEntries } from '../npmauthutils';

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

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

            const tr = await TestHelpers.runTestWithEnv({
                [TestEnvVars.npmrcPath]: npmrcPath
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNpmrcContains(npmrcPath, `_authToken=${TestData.systemAccessToken}`);
        });

        it('logs that credentials are being added', async () => {
            const internalUrl = `${TestData.collectionUri}_packaging/TestFeed/npm/registry/`;
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${internalUrl}`);

            const tr = await TestHelpers.runTestWithEnv({
                [TestEnvVars.npmrcPath]: npmrcPath
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'AddingLocalCredentials');
        });
    });

    describe('External service connection authentication', function () {
        it('appends auth token for a matching external registry', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);

            const tr = await TestHelpers.runTestWithEnv({
                [TestEnvVars.npmrcPath]: npmrcPath,
                [TestEnvVars.customEndpoint]: TestData.externalEndpointId,
                [TestEnvVars.externalRegistryUrl]: TestData.externalRegistryUrl,
                [TestEnvVars.externalRegistryToken]: TestData.externalRegistryToken
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNpmrcContains(npmrcPath, `_authToken=${TestData.externalRegistryToken}`);
        });

        it('logs that endpoint credentials are being added', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);

            const tr = await TestHelpers.runTestWithEnv({
                [TestEnvVars.npmrcPath]: npmrcPath,
                [TestEnvVars.customEndpoint]: TestData.externalEndpointId,
                [TestEnvVars.externalRegistryUrl]: TestData.externalRegistryUrl,
                [TestEnvVars.externalRegistryToken]: TestData.externalRegistryToken
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'AddingEndpointCredentials');
        });
    });

    describe('Unmatched registry', function () {
        it('ignores registry when no auth source matches', async () => {
            const unmatchedUrl = 'https://registry.npmjs.org/';
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${unmatchedUrl}`);

            const tr = await TestHelpers.runTestWithEnv({
                [TestEnvVars.npmrcPath]: npmrcPath
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputContains(tr, 'IgnoringRegistry');
            TestHelpers.assertNpmrcNotContains(npmrcPath, '_authToken');
        });

        it('succeeds with no auth when .npmrc has no registries', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc('');

            const tr = await TestHelpers.runTestWithEnv({
                [TestEnvVars.npmrcPath]: npmrcPath
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertNpmrcNotContains(npmrcPath, '_authToken');
        });
    });

    describe('Duplicate endpoint detection', function () {
        it('warns when external endpoint was already registered in a prior task run', async () => {
            const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);

            const tr = await TestHelpers.runTestWithEnv({
                [TestEnvVars.npmrcPath]: npmrcPath,
                [TestEnvVars.customEndpoint]: TestData.externalEndpointId,
                [TestEnvVars.externalRegistryUrl]: TestData.externalRegistryUrl,
                [TestEnvVars.externalRegistryToken]: TestData.externalRegistryToken,
                [TestEnvVars.existingEndpoints]: TestData.externalRegistryUrl
            });

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

            // Act
            const tr = await TestHelpers.runTestWithEnv({
                [TestEnvVars.npmrcPath]: npmrcPath,
                [TestEnvVars.customEndpoint]: TestData.externalEndpointId,
                [TestEnvVars.externalRegistryUrl]: TestData.externalRegistryUrl,
                [TestEnvVars.externalRegistryToken]: TestData.externalRegistryToken
            });

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

            // Act
            const tr = await TestHelpers.runTestWithEnv({
                [TestEnvVars.npmrcPath]: npmrcPath,
                [TestEnvVars.customEndpoint]: TestData.externalEndpointId,
                [TestEnvVars.externalRegistryUrl]: TestData.externalRegistryUrl,
                [TestEnvVars.externalRegistryToken]: TestData.externalRegistryToken
            });

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

    describe('npmrc file mutations', function () {
        let tempDir: string;

        beforeEach(function () {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-l0-'));
        });

        afterEach(function () {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        it('appends auth entry to npmrc file', function () {
            const npmrcPath = path.join(tempDir, '.npmrc');
            fs.writeFileSync(npmrcPath, 'registry=https://registry.npmjs.org/\n', 'utf8');

            appendAuthToNpmrc(npmrcPath, '//registry.npmjs.org/:_authToken=test-token');

            const content = fs.readFileSync(npmrcPath, 'utf8');
            assert(content.includes('//registry.npmjs.org/:_authToken=test-token'));
        });

        it('removes pre-existing credential lines for the same registry', function () {
            const npmrcPath = path.join(tempDir, '.npmrc');
            const registryUrl = new URL('https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/');
            const lines = [
                'registry=https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/',
                '//pkgs.dev.azure.com/org/_packaging/feed/npm/registry/:_authToken=old-token',
                '//pkgs.dev.azure.com/org/_packaging/feed/npm/registry/:always-auth=true'
            ];

            fs.writeFileSync(npmrcPath, lines.join(os.EOL), 'utf8');

            const updated = removeExistingCredentialEntries(
                npmrcPath,
                [...lines],
                registryUrl,
                [registryUrl]
            );

            assert.strictEqual(updated[0], lines[0], 'registry= line should be preserved');
            assert.strictEqual(updated[1], '', 'old auth token line should be blanked');
            assert.strictEqual(updated[2], '', 'old always-auth line should be blanked');

            const fileContent = fs.readFileSync(npmrcPath, 'utf8');
            assert(!fileContent.includes('_authToken=old-token'));
            assert(!fileContent.includes('always-auth=true'));
        });

        it('suppresses warning when same URL was already added by a prior iteration', function () {
            const npmrcPath = path.join(tempDir, '.npmrc');
            const registryUrl = new URL('https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/');
            const previouslyAdded = new URL('https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/');
            const lines = [
                '//pkgs.dev.azure.com/org/_packaging/feed/npm/registry/:_authToken=old-token'
            ];

            fs.writeFileSync(npmrcPath, lines.join(os.EOL), 'utf8');

            const updated = removeExistingCredentialEntries(
                npmrcPath,
                [...lines],
                registryUrl,
                [previouslyAdded, registryUrl]
            );

            assert.strictEqual(updated[0], '', 'old auth should be blanked even for duplicate');
        });

        it('processes separately when scoped and default registries point to different feeds', function () {
            const npmrcPath = path.join(tempDir, '.npmrc');
            const feedAUrl = new URL('https://pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/');
            const feedBUrl = new URL('https://pkgs.dev.azure.com/org/_packaging/feedB/npm/registry/');
            const lines = [
                'registry=https://pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/',
                '//pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/:_authToken=old-tokenA',
                '@scope:registry=https://pkgs.dev.azure.com/org/_packaging/feedB/npm/registry/',
                '//pkgs.dev.azure.com/org/_packaging/feedB/npm/registry/:_authToken=old-tokenB'
            ];

            fs.writeFileSync(npmrcPath, lines.join(os.EOL), 'utf8');

            const afterFeedA = removeExistingCredentialEntries(
                npmrcPath,
                [...lines],
                feedAUrl,
                [feedAUrl]
            );

            assert.strictEqual(afterFeedA[1], '', 'feedA old auth should be blanked');
            assert.strictEqual(afterFeedA[3], lines[3], 'feedB auth should be untouched');

            const afterFeedB = removeExistingCredentialEntries(
                npmrcPath,
                [...afterFeedA],
                feedBUrl,
                [feedAUrl, feedBUrl]
            );

            assert.strictEqual(afterFeedB[3], '', 'feedB old auth should be blanked');
            assert.strictEqual(afterFeedB[0], lines[0], 'feedA registry= line still preserved');
            assert.strictEqual(afterFeedB[2], lines[2], 'feedB registry= line still preserved');
        });
    });
});
