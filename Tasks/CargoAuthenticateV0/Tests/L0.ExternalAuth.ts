import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';
import { TestDataBuilder } from './TestConstants';

describe('CargoAuthenticate L0 Suite - External Authentication (Service Connections)', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('External Service Connection Authentication', function() {
        it('authenticates registry with matching external service connection', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExternalAuth('test-registry', 'ExternalConnection')
            );
            
            // Assert
            TestHelpers.assertSuccess(tr, 'loc_mock_AddingAuthExternalRegistry');
            TestHelpers.assertEnvVarSet(tr, 'CARGO_REGISTRIES_TEST_REGISTRY_TOKEN', true);
        });

        it('external connection bypasses collection host validation for different Azure DevOps org', async () => {
            // Arrange & Act
            // Registry in 'externalorg' but collection is 'testorg'
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExternalAuth('test-registry', 'ExternalConnection', {
                    '__mockConfigContent__': testConstants.TestData.externalAzureDevOpsToml
                })
            );
            
            // Assert
            TestHelpers.assertSuccess(tr, 'loc_mock_AddingAuthExternalRegistry');
            TestHelpers.assertTelemetryEmitted(tr, { ExternalFeedAuthCount: 1 });
        });

        it('external connection takes precedence over System.AccessToken when URL matches', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExternalAuth('test-registry', 'ExternalConnection', {
                    [testConstants.TestEnvVars.systemAccessToken]: testConstants.TestData.defaultAccessToken
                })
            );
            
            // Assert
            TestHelpers.assertSuccess(tr, 'loc_mock_AddingAuthExternalRegistry');
            TestHelpers.assertTelemetryEmitted(tr, { ExternalFeedAuthCount: 1, InternalFeedAuthCount: 0 });
        });

        it('falls back to System.AccessToken when no external connection URL matches', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    '__mockServiceConnections__': JSON.stringify([{
                        authType: 'UsernamePassword',
                        packageSource: {
                            uri: 'https://pkgs.dev.azure.com/differentorg/_packaging/different-feed/Cargo/index/'
                        },
                        username: 'differentorg',
                        password: testConstants.TestData.externalServiceConnectionToken
                    }])
                })
            );
            
            // Assert
            TestHelpers.assertSuccess(tr, 'loc_mock_AddingAuthRegistry');
            TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 1, ExternalFeedAuthCount: 0 });
        });

        it('handles multiple external connections correctly', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forMixedAuth('internal-registry', 'external-registry', 'ExternalConnection')
            );
            
            // Assert
            TestHelpers.assertSuccess(tr, 'loc_mock_AddingAuthExternalRegistry');
            TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 1, ExternalFeedAuthCount: 1 });
        });
    });

    describe('External Authentication Edge Cases', function() {
        it('handles empty service connections array', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    '__mockServiceConnections__': JSON.stringify([])
                })
            );
            
            // Assert
            TestHelpers.assertSuccess(tr, 'loc_mock_AddingAuthRegistry');
            TestHelpers.assertTelemetryEmitted(tr, { InternalFeedAuthCount: 1 });
        });

        it('handles unknown service connection auth type', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    '__mockServiceConnections__': JSON.stringify([{
                        authType: 'UnknownType',
                        packageSource: {
                            uri: 'https://pkgs.dev.azure.com/testorg/_packaging/test-feed/Cargo/index/'
                        }
                    }])
                })
            );
            
            // Assert
            TestHelpers.assertFailure(tr, {
                expectedError: 'Error_InvalidServiceConnection'
            });
        });

        it('handles malformed service connection without packageSource', async () => {
            // Arrange & Act
            const tr = await TestHelpers.runTest(
                TestDataBuilder.withDefaults({
                    '__mockServiceConnections__': JSON.stringify([{
                        authType: 'UsernamePassword',
                        username: 'test',
                        password: 'test'
                        // Missing packageSource - will cause task to fail
                    }])
                })
            );
            
            // Assert
            // Task fails when packageSource is missing (format guaranteed by platform)
            TestHelpers.assertFailure(tr, {
                shouldHaveErrors: true
            });
        });
    });
});
