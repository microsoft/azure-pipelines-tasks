import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('CargoAuthenticate L0 Suite - Mixed Authentication Scenarios', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Multiple Authentication Types', function() {
        it('handles mixed internal and external registry authentication', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.mixedRegistriesToml;
            
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
            assert(tr.succeeded, 'Task should handle mixed authentication');
            assert(tr.stdout.indexOf('"InternalFeedAuthCount":1') > 0 ||
                   tr.stdout.indexOf('"InternalFeedAuthCount": 1') > 0,
                'Should authenticate one internal registry');
            assert(tr.stdout.indexOf('"ExternalFeedAuthCount":1') > 0 ||
                   tr.stdout.indexOf('"ExternalFeedAuthCount": 1') > 0,
                'Should authenticate one external registry');
        });

        it('emits correct telemetry for mixed authentication types', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.mixedRegistriesToml;
            
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
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('Telemetry emitted:') > 0,
                'Should emit telemetry');
            assert(tr.stdout.indexOf(testConstants.TestData.telemetryArea) > 0,
                'Should emit telemetry for correct area');
            // Verify both counts are present
            const hasInternalCount = tr.stdout.indexOf('InternalFeedAuthCount') > 0;
            const hasExternalCount = tr.stdout.indexOf('ExternalFeedAuthCount') > 0;
            assert(hasInternalCount && hasExternalCount,
                'Telemetry should include both InternalFeedAuthCount and ExternalFeedAuthCount');
        });

        it('emits zero counts when no registries are authenticated', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.externalRegistryToml;
            // External registry with no matching connection and not in collection
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed even when no registries authenticated');
            assert(tr.stdout.indexOf('"InternalFeedAuthCount":0') > 0 ||
                   tr.stdout.indexOf('"InternalFeedAuthCount": 0') > 0,
                'Should report zero internal authentications');
        });
    });

    describe('Error Scenarios', function() {
        it('sets task result to Failed on error', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__throwTelemetryError__'] = 'true';
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when error occurs');
        });
    });
});
