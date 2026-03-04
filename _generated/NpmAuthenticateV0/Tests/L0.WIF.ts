// NpmAuthenticate L0 tests - Workload Identity Federation (WIF)
// These tests exercise the #if WIF code paths, which are only compiled into
// the NpmAuthenticateV0_Wif build variant.

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars, TestData } from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NpmAuthenticate L0 - Workload Identity Federation (WIF)', function () {
    this.timeout(20000);

    beforeEach(function () {
        TestHelpers.beforeEach();
    });

    afterEach(function () {
        TestHelpers.afterEach();
    });

    it('authenticates a specific feed via feedUrl + service connection', async () => {
        // Arrange: .npmrc has one registry that matches the feedUrl
        const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.wifRegistryUrl}`);
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.npmrcPath] = npmrcPath;
        process.env[TestEnvVars.npmrcRegistries] = TestData.wifRegistryUrl;
        process.env[TestEnvVars.workloadIdentityServiceConnection] = TestData.wifServiceConnection;
        process.env[TestEnvVars.wifRegistryUrl] = TestData.wifRegistryUrl;
        process.env[TestEnvVars.wifToken] = TestData.wifToken;

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertAuthAppended(tr, TestData.wifToken,
            'The WIF federated token should be written as the auth token for the registry');
        TestHelpers.assertOutputContains(tr, 'Info_SuccessAddingFederatedFeedAuth');
    });

    it('fails when feedUrl is not present in the .npmrc file', async () => {
        // Arrange: .npmrc has a different registry, not the one specified as feedUrl
        const differentRegistry = 'https://pkgs.dev.azure.com/testorg/_packaging/OtherFeed/npm/registry/';
        const npmrcPath = TestHelpers.createTempNpmrc(`registry=${differentRegistry}`);
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.npmrcPath] = npmrcPath;
        process.env[TestEnvVars.npmrcRegistries] = differentRegistry;
        process.env[TestEnvVars.workloadIdentityServiceConnection] = TestData.wifServiceConnection;
        // feedUrl points to a registry that is NOT in the .npmrc
        process.env[TestEnvVars.wifRegistryUrl] = TestData.wifRegistryUrl;
        process.env[TestEnvVars.wifToken] = TestData.wifToken;

        // Act
        await tr.runAsync();

        // Assert: task must fail because the specified feedUrl has no matching entry in .npmrc
        TestHelpers.assertFailure(tr, 'Task should fail when feedUrl is not matched by any registry in .npmrc');
        TestHelpers.assertOutputContains(tr, 'IgnoringRegistry');
    });

    it('authenticates all .npmrc registries when no feedUrl is given', async () => {
        // Arrange: two registries in .npmrc, no feedUrl — WIF auth applied to both
        const url1 = 'https://pkgs.dev.azure.com/testorg/_packaging/FeedA/npm/registry/';
        const url2 = 'https://pkgs.dev.azure.com/testorg/_packaging/FeedB/npm/registry/';
        const npmrcPath = TestHelpers.createTempNpmrc(
            `@scopeA:registry=${url1}\n@scopeB:registry=${url2}`
        );
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.npmrcPath] = npmrcPath;
        process.env[TestEnvVars.npmrcRegistries] = [url1, url2].join(';');
        process.env[TestEnvVars.workloadIdentityServiceConnection] = TestData.wifServiceConnection;
        // No wifRegistryUrl → feedUrl input is not set
        process.env[TestEnvVars.wifToken] = TestData.wifToken;

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
        const appended = TestHelpers.getAppendedAuth(tr);
        assert.strictEqual(appended.length, 2, 'appendToNpmrc should be called once per registry');
        assert(appended.every(a => a.includes(TestData.wifToken)),
            'Every appended auth entry should contain the WIF token');
    });

    it('fails when feedUrl is provided without a service connection', async () => {
        // Arrange: feedUrl is set but workloadIdentityServiceConnection is not
        const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.wifRegistryUrl}`);
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.npmrcPath] = npmrcPath;
        process.env[TestEnvVars.npmrcRegistries] = TestData.wifRegistryUrl;
        process.env[TestEnvVars.wifRegistryUrl] = TestData.wifRegistryUrl;
        // workloadIdentityServiceConnection intentionally not set

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertFailure(tr, 'Task should fail when feedUrl is set without a WIF service connection');
        TestHelpers.assertOutputContains(tr, 'MissingFeedUrlOrServiceConnection');
    });

    it('fails when WIF token acquisition fails', async () => {
        // Arrange: service connection is set but getFederatedWorkloadIdentityCredentials throws
        const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.wifRegistryUrl}`);
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.npmrcPath] = npmrcPath;
        process.env[TestEnvVars.npmrcRegistries] = TestData.wifRegistryUrl;
        process.env[TestEnvVars.workloadIdentityServiceConnection] = TestData.wifServiceConnection;
        process.env[TestEnvVars.wifRegistryUrl] = TestData.wifRegistryUrl;
        process.env[TestEnvVars.wifShouldFail] = 'true';

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertFailure(tr, 'Task should fail when federated token acquisition throws');
    });
});
