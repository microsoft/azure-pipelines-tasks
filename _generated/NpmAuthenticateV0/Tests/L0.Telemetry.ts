import * as path from 'path';
import * as os from 'os';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars, TestData } from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NpmAuthenticate L0 - Telemetry', function () {
    this.timeout(20000);

    beforeEach(function () {
        TestHelpers.beforeEach();
    });

    afterEach(function () {
        TestHelpers.afterEach();
    });

    it('emits telemetry on successful authentication', async () => {
        // Arrange: internal feed that matches the collection URI host
        const internalUrl = `${TestData.collectionUri}_packaging/TestFeed/npm/registry/`;
        const npmrcPath = TestHelpers.createTempNpmrc(`registry=${internalUrl}`);
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        process.env[TestEnvVars.npmrcPath] = npmrcPath;

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(
            tr,
            `${TestData.telemetryPrefix}Packaging.NpmAuthenticateV0`,
            'Telemetry should be emitted to the Packaging area for NpmAuthenticateV0'
        );
    });

    it('emits telemetry even when the task fails', async () => {
        // Arrange: point at a file without .npmrc extension — task fails early
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.npmrcPath] = path.join(os.tmpdir(), 'badfile.json');

        // Act
        await tr.runAsync();

        // Assert
        TestHelpers.assertFailure(tr);
        TestHelpers.assertOutputContains(
            tr,
            `${TestData.telemetryPrefix}Packaging.NpmAuthenticateV0`,
            'Telemetry should be emitted in the finally block even on task failure'
        );
    });

    it('records external feed auth count in telemetry', async () => {
        // Arrange: one external service connection to authenticate
        const npmrcPath = TestHelpers.createTempNpmrc(`registry=${TestData.externalRegistryUrl}`);
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
        TestHelpers.assertOutputContains(tr, '"ExternalFeedAuthCount":1');
    });
});
