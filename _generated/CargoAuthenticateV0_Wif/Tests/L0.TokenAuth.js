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
describe('CargoAuthenticate L0 Suite - Token Authentication (crates.io)', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers_1.TestHelpers.beforeEach());
    afterEach(() => TestHelpers_1.TestHelpers.afterEach());
    describe('crates.io Token Authentication', function () {
        it('authenticates crates.io with Token service connection', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
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
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, 'CARGO_REGISTRY_TOKEN');
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, 'CARGO_REGISTRY_CREDENTIAL_PROVIDER', 'cargo:token');
        }));
        it('marks Token connection credential as secret', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
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
            yield tr.runAsync();
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertMarkedAsSecret(tr, testConstants.TestData.cratesIoToken);
        }));
    });
    describe('Token Authentication Validation', function () {
        it('rejects Token connection for non-crates.io URLs', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
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
            yield tr.runAsync();
            // Assert
            assert(tr.failed, 'Task should fail when Token connection is used for non-crates.io URL');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'Should have error about invalid Token connection');
        }));
        it('rejects Token connection with invalid URL format', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
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
            yield tr.runAsync();
            // Assert
            assert(tr.failed, 'Task should fail when Token connection has invalid URL');
            assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'Should have error about invalid URL');
        }));
    });
});
