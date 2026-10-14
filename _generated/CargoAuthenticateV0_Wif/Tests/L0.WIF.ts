import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('CargoAuthenticate L0 Suite - Workload Identity Federation', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Workload Identity Federation (WIF)', function() {
        it('successfully authenticates using WIF when service connection is provided', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.registryNames] = testConstants.TestData.testRegistry;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with WIF authentication');
            assert(tr.stdout.indexOf('Mock WIF: getFederatedWorkloadIdentityCredentialsForFeed called') > 0,
                'Should call WIF credentials provider');
        });

        it('falls back to System.AccessToken when WIF not configured', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            // Not setting WIF service connection
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with System.AccessToken fallback');
            assert(tr.stdout.indexOf('Mock WIF: getFederatedWorkloadIdentityCredentialsForFeed called') < 0,
                'Should NOT call WIF credentials provider when not configured');
        });

        it('fails gracefully when WIF authentication fails', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.registryNames] = testConstants.TestData.testRegistry;
            process.env[testConstants.TestEnvVars.wifShouldFail] = 'true';
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when WIF authentication fails');
            assert(tr.stdout.indexOf('Mock WIF: getFederatedWorkloadIdentityCredentialsForFeed called') > 0,
                'Should attempt WIF authentication');
        });

        it('emits telemetry with correct federated auth count when using WIF', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.registryNames] = testConstants.TestData.testRegistry;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with WIF');
            assert(tr.stdout.indexOf('Telemetry emitted:') > 0,
                'Should emit telemetry');
            assert(tr.stdout.indexOf('"FederatedConnectionAuthCount":1') > 0 ||
                   tr.stdout.indexOf('"FederatedConnectionAuthCount": 1') > 0,
                'Should track federated auth count as 1 when WIF succeeds');
        });

        it('marks WIF token as secret', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.registryNames] = testConstants.TestData.testRegistry;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('##vso[task.setsecret]') > 0,
                'Should mark WIF token as secret');
        });

        it('fails when WIF registry not found in TOML', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.registryNames] = 'non-existent-registry';
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when WIF registry name not found in TOML');
            assert(tr.stdout.indexOf('non-existent-registry') > 0 || tr.errorIssues.length > 0,
                'Should reference the missing registry name in error');
        });

        it('fails before WIF authentication when registry environment keys collide', async () => {
            const tr = await TestHelpers.runTest(
                testConstants.TestDataBuilder.forWifAuth('test-registry', {
                    [testConstants.TestEnvVars.registryNames]: testConstants.TestData.testRegistry,
                    '__mockConfigContent__': testConstants.TestData.collidingRegistryToml
                })
            );

            TestHelpers.assertFailure(tr, {
                expectedError: 'loc_mock_RegistryEnvKeyCollision'
            });
            TestHelpers.assertTelemetryEmitted(tr, { FederatedConnectionAuthCount: 0 });
        });

        it('fails when WIF returns null token', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.registryNames] = testConstants.TestData.testRegistry;
            process.env[testConstants.TestEnvVars.wifToken] = ''; // Empty token
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when WIF returns null/empty token');
        });

        it('rejects a spoofed registry before setting a WIF token', async () => {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.registryNames] = testConstants.TestData.testRegistry;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            process.env['__mockConfigContent__'] = `
[registries]
test-registry = { index = "sparse+https://pkgs.dev.azure.com.attacker.example/feed/Cargo/index/" }
`;

            await tr.runAsync();

            assert(tr.failed, 'Task should reject an untrusted WIF registry');
            assert(tr.stdout.indexOf('Error_FeedUrlUntrustedHost') > 0,
                'Task should report the feed URL validation failure');
            assert(tr.stdout.indexOf('##vso[task.setvariable variable=CARGO_REGISTRIES_TEST_REGISTRY_TOKEN;') < 0,
                'Task must not set a token for the untrusted registry');
        });
    });
});
