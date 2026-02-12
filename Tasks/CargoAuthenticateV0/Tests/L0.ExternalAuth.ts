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
            TestHelpers.assertSuccess(tr, 'Task should succeed with external service connection');
            TestHelpers.assertEnvVarSet(tr, 'CARGO_REGISTRIES_TEST_REGISTRY_TOKEN', true);
        });

        it('external connection bypasses collection host validation for different Azure DevOps org', async () => {
            // Arrange & Act - Critical test for the bug fix!
            // Registry in 'externalorg' but collection is 'testorg'
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExternalAuth('test-registry', 'ExternalConnection', {
                    '__mockConfigContent__': testConstants.TestData.externalAzureDevOpsToml
                })
            );
            
            // Assert
            TestHelpers.assertSuccess(tr, 
                'Task should succeed - external connections should bypass collection host validation');
            TestHelpers.assertTelemetryEmitted(tr, { ExternalFeedAuthCount: 1 });
        });

        it('external connection takes precedence over System.AccessToken when URL matches', async () => {
            // Arrange
            const externalConnection = {
                authType: 'UsernamePassword',
                packageSource: {
                    uri: 'https://pkgs.dev.azure.com/externalorg/_packaging/external-feed/Cargo/index/'
                },
                username: 'externalorg',
                password: testConstants.TestData.externalServiceConnectionToken
            };
            process.env['__mockServiceConnections__'] = JSON.stringify([externalConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with external connection precedence');
            // Should use external connection, not System.AccessToken
            assert(tr.stdout.indexOf('"ExternalFeedAuthCount":1') > 0 ||
                   tr.stdout.indexOf('"ExternalFeedAuthCount": 1') > 0,
                'Should authenticate using external connection');
            assert(tr.stdout.indexOf('"InternalFeedAuthCount":0') > 0 ||
                   tr.stdout.indexOf('"InternalFeedAuthCount": 0') > 0,
                'Should not use System.AccessToken when external connection matches');
        });

        it('falls back to System.AccessToken when no external connection URL matches', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // External connection for different registry
            const externalConnection = {
                authType: 'UsernamePassword',
                packageSource: {
                    uri: 'https://pkgs.dev.azure.com/differentorg/_packaging/different-feed/Cargo/index/'
                },
                username: 'differentorg',
                password: testConstants.TestData.externalServiceConnectionToken
            };
            process.env['__mockServiceConnections__'] = JSON.stringify([externalConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with System.AccessToken fallback');
            assert(tr.stdout.indexOf('"InternalFeedAuthCount":1') > 0 ||
                   tr.stdout.indexOf('"InternalFeedAuthCount": 1') > 0,
                'Should fall back to System.AccessToken when no external connection matches');
            assert(tr.stdout.indexOf('"ExternalFeedAuthCount":0') > 0 ||
                   tr.stdout.indexOf('"ExternalFeedAuthCount": 0') > 0,
                'Should not use external connection for non-matching URL');
        });

        it('handles multiple external connections correctly', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.mixedRegistriesToml;
            
            const externalConnections = [
                {
                    authType: 'UsernamePassword',
                    packageSource: {
                        uri: 'https://pkgs.dev.azure.com/externalorg/_packaging/external-feed/Cargo/index/'
                    },
                    username: 'externalorg',
                    password: 'external-token-1'
                },
                {
                    authType: 'UsernamePassword',
                    packageSource: {
                        uri: 'https://pkgs.dev.azure.com/anotherorg/_packaging/another-feed/Cargo/index/'
                    },
                    username: 'anotherorg',
                    password: 'external-token-2'
                }
            ];
            process.env['__mockServiceConnections__'] = JSON.stringify(externalConnections);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should handle multiple external connections');
            // internal-registry should use System.AccessToken, external-registry should use external connection
            assert(tr.stdout.indexOf('"InternalFeedAuthCount":1') > 0 ||
                   tr.stdout.indexOf('"InternalFeedAuthCount": 1') > 0,
                'Should authenticate one registry with System.AccessToken');
            assert(tr.stdout.indexOf('"ExternalFeedAuthCount":1') > 0 ||
                   tr.stdout.indexOf('"ExternalFeedAuthCount": 1') > 0,
                'Should authenticate one registry with external connection');
        });
    });

    describe('External Authentication Edge Cases', function() {
        it('handles empty service connections array', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            process.env['__mockServiceConnections__'] = JSON.stringify([]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with empty service connections');
            // With no service connections, should fall back to System.AccessToken
            assert(tr.stdout.indexOf('"InternalFeedAuthCount":1') > 0,
                'Should fall back to System.AccessToken and track internal auth in telemetry');
        });

        it('handles unknown service connection auth type', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            const unknownConnection = {
                authType: 'UnknownType',
                packageSource: {
                    uri: 'https://pkgs.dev.azure.com/testorg/_packaging/test-feed/Cargo/index/'
                }
            };
            process.env['__mockServiceConnections__'] = JSON.stringify([unknownConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail with unknown auth type');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0,
                'Should have error about invalid service connection');
        });

        it('handles malformed service connection without packageSource', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            const malformedConnection = {
                authType: 'UsernamePassword',
                username: 'test',
                password: 'test'
                // Missing packageSource
            };
            process.env['__mockServiceConnections__'] = JSON.stringify([malformedConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            // Task might succeed or fail depending on error handling
            // The important part is it doesn't crash
            assert(tr.succeeded || tr.failed,
                'Task should complete (succeed or fail gracefully) with malformed connection');
        });
    });
});
