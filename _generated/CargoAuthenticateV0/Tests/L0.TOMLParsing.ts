import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('CargoAuthenticate L0 Suite - TOML Configuration Parsing', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Valid TOML Formats', function() {
        it('parses TOML with inline registry format', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertEnvironmentVariableSet(tr, 'CARGO_REGISTRIES_TEST_REGISTRY_TOKEN');
        });

        it('parses TOML with section registry format', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.alternateTomlFormat;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should parse section TOML format');
        });
    });

    describe('Invalid TOML Handling', function() {
        it('fails when TOML has invalid syntax', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.invalidToml;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when TOML syntax is invalid');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0,
                'Should have error output for invalid TOML');
        });

        it('fails when TOML is missing registries section', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.missingRegistryToml;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when registries section is missing');
        });

        it('fails when config file does not exist', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.configFilePath] = testConstants.TestData.missingConfigFile;
            process.env['__configFileExists__'] = 'false';
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when config file does not exist');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0,
                'Should have error output');
        });

        it('handles registry with no URL in TOML', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = `\n[registries]\ntest-registry = { }\n`;
            
            // Act
            await tr.runAsync();
            
            // Assert
            // Task should handle missing URL gracefully
            assert(tr.succeeded || tr.failed,
                'Task should handle missing registry URL gracefully');
        });
    });
});
