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
            TestHelpers.assertEnvVarSet(tr, testConstants.TestData.expectedTokenVar);
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
            TestHelpers.assertEnvVarSet(tr, testConstants.TestData.expectedTokenVar, true);
        });

        it('handles multiple registries in same organization', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    '__mockConfigContent__': testConstants.TestData.multiRegistryTomlContent
                })
            );
            
            // Assert
            TestHelpers.assertSuccess(tr, 'loc_mock_AddingAuthRegistry another-registry');
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
            TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 0 });
        });

        it('handles packaging location service failure gracefully', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forInternalAuth('test-registry', {
                    '__packagingLocationShouldFail__': 'true'
                })
            );
            
            // Assert
            TestHelpers.assertFailure(tr, {
                expectedError: 'Unable to get packaging URIs'
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
            TestHelpers.assertStdoutContains(tr, 'already-set-token', 
                'Should keep the already-set token');
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
