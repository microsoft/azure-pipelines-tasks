import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';
import { TestDataBuilder } from './TestConstants';

describe('CargoAuthenticate L0 Suite - Internal Authentication (System.AccessToken)', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Basic System.AccessToken Authentication', function() {
        it('authenticates internal registry with System.AccessToken', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forInternalAuth()
            );
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.expectedTokenVar);
            TestHelpers.assertStdoutContains(tr, 'Mock: verifyAzureArtifactsFeedUrl called');
        });

        it('marks access token as secret', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forInternalAuth('test-registry', {
                    [testConstants.TestEnvVars.systemAccessToken]: testConstants.TestData.secretToken
                })
            );
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.expectedTokenVar);
            TestHelpers.assertMarkedAsSecret(tr, testConstants.TestData.secretToken);
        });

        it('handles multiple registries in same organization', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    '__mockConfigContent__': testConstants.TestData.multiRegistryTomlContent
                })
            );
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 2 });
        });
    });

    describe('Internal Authentication Edge Cases', function() {
        it('handles missing System.AccessToken', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest({
                [testConstants.TestEnvVars.configFilePath]: testConstants.TestData.validConfigFile,
                '__mockConfigContent__': testConstants.TestData.validTomlContent
                // Intentionally not setting systemAccessToken
            });
            
            // Assert
            // Task may succeed with empty token or handle gracefully
            TestHelpers.assertSuccess(tr);
        });

        it('skips registries with URLs not in allowed hosts', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    '__mockConfigContent__': testConstants.TestData.externalRegistryToml
                })
            );
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, 'loc_mock_SkippingNonAzureDevOpsRegistry');
            TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 0 });
        });

        it('does not expose System.AccessToken to an HTTP registry on an allowed host', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    '__mockConfigContent__': `
[registries]
test-registry = { index = "sparse+http://pkgs.dev.azure.com/testorg/_packaging/test-feed/Cargo/index/" }
`
                })
            );

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.expectedTokenVar);
            TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 0 });
        });

        it('fails when an ADO registry shares a Cargo environment key with another registry', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    '__mockConfigContent__': testConstants.TestData.collidingRegistryToml
                })
            );

            TestHelpers.assertFailure(tr, {
                expectedError: 'loc_mock_RegistryEnvKeyCollision'
            });
            TestHelpers.assertStdoutContains(tr, 'CARGO_REGISTRIES_TEST_REGISTRY_TOKEN');
        });

        it('uses ASCII uppercase when computing the Cargo environment key', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forInternalAuth('i-registry')
            );
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, 'CARGO_REGISTRIES_I_REGISTRY_TOKEN');
            TestHelpers.assertEnvironmentVariableSet(tr, 'CARGO_REGISTRIES_I_REGISTRY_TOKEN');
        });

        it('fails when shared feed verification cannot complete', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forInternalAuth('test-registry', {
                    '__feedVerificationShouldFail__': 'true'
                })
            );
            
            // Assert
            TestHelpers.assertFailure(tr, {
                expectedError: 'Simulated feed verification failure'
            });
        });
    });

    describe('Overwrite Protection', function() {
        it('skips already-authenticated registry', async () => {
            // Arrange
            // Pre-set the environment variable before test
            process.env['CARGO_REGISTRIES_TEST_REGISTRY_TOKEN'] = 'already-set-token';
            
            // Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forInternalAuth('test-registry', {
                    '__mockConfigContent__': testConstants.TestData.preAuthenticatedToml
                })
            );
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, 'loc_mock_ConnectionAlreadySet', 
                'Should warn when registry already has credentials');
            TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 0 });
        });

        it('logs when registry authentication is skipped due to existing credentials', async () => {
            // Arrange
            // Pre-set the environment variable before test
            process.env['CARGO_REGISTRIES_TEST_REGISTRY_TOKEN'] = 'already-set-token';
            
            // Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forInternalAuth('test-registry', {
                    '__mockConfigContent__': testConstants.TestData.preAuthenticatedToml
                })
            );
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertStdoutContains(tr, 'loc_mock_ConnectionAlreadySet',
                'Should warn when registry already has credentials');
        });
    });
});
