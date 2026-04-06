import * as os from 'os';
import * as path from 'path';
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

        // Act
        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.npmrcPath]: npmrcPath
        });

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

        // Act
        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.npmrcPath]: path.join(os.tmpdir(), 'badfile.json')
        });

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

        // Act
        const tr = await TestHelpers.runTestWithEnv({
            [TestEnvVars.npmrcPath]: npmrcPath,
            [TestEnvVars.customEndpoint]: TestData.externalEndpointId,
            [TestEnvVars.externalRegistryUrl]: TestData.externalRegistryUrl,
            [TestEnvVars.externalRegistryToken]: TestData.externalRegistryToken
        });

        // Assert
        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, '"ExternalFeedAuthCount":1');
    });
});
