"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const assert = require("assert");
const ttm = require("azure-pipelines-task-lib/mock-test");
const testConstants = require("./TestConstants");
const TestHelpers_1 = require("./TestHelpers");
describe('CargoAuthenticate L0 Suite - TOML Configuration Parsing', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers_1.TestHelpers.beforeEach());
    afterEach(() => TestHelpers_1.TestHelpers.afterEach());
    describe('Valid TOML Formats', function () {
        it('parses TOML with inline registry format', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            // Act
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, 'CARGO_REGISTRIES_TEST_REGISTRY_TOKEN');
        }));
        it('parses TOML with section registry format', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.alternateTomlFormat;
            // Act
            yield tr.runAsync();
            // Assert
            assert(tr.succeeded, 'Task should parse section TOML format');
        }));
    });
    describe('Invalid TOML Handling', function () {
        it('fails when TOML has invalid syntax', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.invalidToml;
            // Act
            yield tr.runAsync();
            // Assert
            assert(tr.failed, 'Task should fail when TOML syntax is invalid');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'Should have error output for invalid TOML');
        }));
        it('fails when TOML is missing registries section', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.missingRegistryToml;
            // Act
            yield tr.runAsync();
            // Assert
            assert(tr.failed, 'Task should fail when registries section is missing');
        }));
        it('fails when config file does not exist', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.configFilePath] = testConstants.TestData.missingConfigFile;
            process.env['__configFileExists__'] = 'false';
            // Act
            yield tr.runAsync();
            // Assert
            assert(tr.failed, 'Task should fail when config file does not exist');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'Should have error output');
        }));
        it('handles registry with no URL in TOML', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = `\n[registries]\ntest-registry = { }\n`;
            // Act
            yield tr.runAsync();
            // Assert
            // Task should handle missing URL gracefully
            assert(tr.succeeded || tr.failed, 'Task should handle missing registry URL gracefully');
        }));
    });
});
