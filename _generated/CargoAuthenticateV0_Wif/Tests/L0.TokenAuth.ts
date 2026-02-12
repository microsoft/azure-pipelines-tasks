import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('CargoAuthenticate L0 Suite - Token Authentication (crates.io)', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('crates.io Token Authentication', function() {
        it('authenticates crates.io with Token service connection', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.cratesIoToml;
            
            const tokenConnection = {
                authType: 'Token',
                packageSource: {
                    uri: 'https://crates.io'
                },
                token: testConstants.TestData.cratesIoToken
            };
            process.env['__mockServiceConnections__'] = JSON.stringify([tokenConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with Token connection for crates.io');
            assert(tr.stdout.indexOf('CARGO_REGISTRY_TOKEN') > 0,
                'Should set global CARGO_REGISTRY_TOKEN for crates.io');
            assert(tr.stdout.indexOf('cargo:token') > 0,
                'Should set CARGO_REGISTRY_CREDENTIAL_PROVIDER to cargo:token');
        });

        it('marks Token connection credential as secret', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.cratesIoToml;
            
            const tokenConnection = {
                authType: 'Token',
                packageSource: {
                    uri: 'https://crates.io'
                },
                token: testConstants.TestData.cratesIoToken
            };
            process.env['__mockServiceConnections__'] = JSON.stringify([tokenConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('##vso[task.setsecret]') > 0,
                'Should mark Token connection credential as secret');
        });
    });

    describe('Token Authentication Validation', function() {
        it('rejects Token connection for non-crates.io URLs', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            const tokenConnection = {
                authType: 'Token',
                packageSource: {
                    uri: 'https://pkgs.dev.azure.com/testorg/_packaging/test-feed/Cargo/index/'
                },
                token: 'should-not-work'
            };
            process.env['__mockServiceConnections__'] = JSON.stringify([tokenConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when Token connection is used for non-crates.io URL');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0,
                'Should have error about invalid Token connection');
        });

        it('rejects Token connection with invalid URL format', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            const tokenConnection = {
                authType: 'Token',
                packageSource: {
                    uri: 'not-a-valid-url'
                },
                token: 'test-token'
            };
            process.env['__mockServiceConnections__'] = JSON.stringify([tokenConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when Token connection has invalid URL');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0,
                'Should have error about invalid URL');
        });
    });
});
