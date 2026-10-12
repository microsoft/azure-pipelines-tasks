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
exports.TestHelpers = void 0;
const path = require("path");
const assert = require("assert");
const ttm = require("azure-pipelines-task-lib/mock-test");
const testConstants = require("./TestConstants");
/**
 * Shared test setup, teardown, and utility functions for consistent test patterns
 */
class TestHelpers {
    /**
     * Clears all test configuration environment variables before each test
     */
    static beforeEach() {
        // Clear all test configuration environment variables
        delete process.env[testConstants.TestEnvVars.systemAccessToken];
        delete process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri];
        delete process.env[testConstants.TestEnvVars.systemDebug];
        delete process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection];
        delete process.env[testConstants.TestEnvVars.wifToken];
        delete process.env[testConstants.TestEnvVars.wifShouldFail];
        delete process.env[testConstants.TestEnvVars.configFilePath];
        delete process.env[testConstants.TestEnvVars.registryNames];
        delete process.env[testConstants.TestEnvVars.cargoServiceConnections];
        delete process.env['__throwTelemetryError__'];
        delete process.env['__mockConfigContent__'];
        delete process.env['__configFileExists__'];
        delete process.env['__mockServiceConnections__'];
        delete process.env['__packagingLocationShouldFail__'];
    }
    /**
     * Cleans up actual environment variables after each test
     */
    static afterEach() {
        // Clean up actual environment variables after each test
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['SYSTEM_DEBUG'];
        delete process.env['CARGO_REGISTRY_TOKEN'];
        delete process.env['CARGO_REGISTRY_CREDENTIAL_PROVIDER'];
        // Clean up any registry-specific env vars that tests might have set
        delete process.env['CARGO_REGISTRIES_TEST_REGISTRY_TOKEN'];
        delete process.env['CARGO_REGISTRIES_TEST_REGISTRY_CREDENTIAL_PROVIDER'];
    }
    /**
     * Run a test with environment setup
     * @param envVars Environment variables to set for the test
     * @returns MockTestRunner instance after execution
     */
    static runTest(envVars) {
        return __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            // Set environment variables
            Object.keys(envVars).forEach(key => {
                process.env[key] = envVars[key];
            });
            yield tr.runAsync();
            return tr;
        });
    }
    /**
     * Assert that the task succeeded
     * @param tr Test runner instance
     * @param expectedMessage Optional message that should appear in stdout
     */
    static assertSuccess(tr, expectedMessage) {
        assert(tr.succeeded, 'Task should have succeeded');
        assert.strictEqual(tr.errorIssues.length, 0, 'Should have no error issues');
        if (expectedMessage) {
            assert(tr.stdout.indexOf(expectedMessage) > 0, `Output should contain: ${expectedMessage}`);
        }
    }
    /**
     * Assert that the task failed
     * @param tr Test runner instance
     * @param options Failure assertion options
     */
    static assertFailure(tr, options = {}) {
        const shouldHaveErrors = options.shouldHaveErrors !== undefined ? options.shouldHaveErrors : true;
        assert(tr.failed, 'Task should have failed');
        if (shouldHaveErrors) {
            assert(tr.errorIssues.length > 0, 'Should have error messages');
        }
        if (options.expectedError) {
            assert(tr.stdout.indexOf(options.expectedError) > 0, `Output should contain error: ${options.expectedError}`);
        }
    }
    /**
     * Assert that an environment variable was set
     * @param tr Test runner instance
     * @param varName Environment variable name
     * @param shouldBeSecret Whether the variable should be marked as secret
     */
    static assertEnvVarSet(tr, varName, shouldBeSecret = false) {
        assert(tr.stdout.indexOf(varName) > 0, `Should set ${varName} environment variable`);
        if (shouldBeSecret) {
            assert(tr.stdout.indexOf('##vso[task.setsecret]') > 0, `${varName} should be marked as secret`);
        }
    }
    /**
     * Assert that telemetry was emitted
     * @param tr Test runner instance
     * @param expectedData Optional data to verify in telemetry
     */
    static assertTelemetryEmitted(tr, expectedData) {
        assert(tr.stdout.indexOf('Telemetry emitted:') > 0, 'Should emit telemetry');
        if (expectedData) {
            Object.keys(expectedData).forEach(key => {
                assert(tr.stdout.indexOf(`"${key}":${expectedData[key]}`) > 0 ||
                    tr.stdout.indexOf(`"${key}": ${expectedData[key]}`) > 0, `Telemetry should contain ${key}:${expectedData[key]}`);
            });
        }
    }
    /**
     * Assert that stdout contains a specific string
     * @param tr Test runner instance
     * @param expectedString String to search for
     * @param message Optional assertion message
     */
    static assertStdoutContains(tr, expectedString, message) {
        assert(tr.stdout.indexOf(expectedString) > 0, message || `Output should contain: ${expectedString}`);
    }
    /**
     * Assert that stdout does not contain a specific string
     * @param tr Test runner instance
     * @param unexpectedString String that should not appear
     * @param message Optional assertion message
     */
    static assertStdoutDoesNotContain(tr, unexpectedString, message) {
        assert(tr.stdout.indexOf(unexpectedString) < 0, message || `Output should not contain: ${unexpectedString}`);
    }
    /**
     * Extract environment variable value from task output
     * Parses ##vso[task.setvariable variable=NAME]VALUE format
     * @param stdout Task stdout
     * @param variableName Name of the variable to extract
     * @returns Variable value or null if not found
     */
    static extractEnvironmentVariable(stdout, variableName) {
        // Look for ##vso[task.setvariable variable=VARIABLE_NAME]VALUE
        const regex = new RegExp(`##vso\\[task\\.setvariable variable=${variableName}(?:;[^\\]]*)?\\]([^\\r\\n]*)`, 'i');
        const match = stdout.match(regex);
        return match ? match[1] : null;
    }
    /**
     * Assert that an environment variable was set with expected value
     * @param tr Test runner instance
     * @param variableName Name of the variable to check
     * @param expectedValue Expected value (optional - just checks it was set if omitted)
     */
    static assertEnvironmentVariableSet(tr, variableName, expectedValue) {
        const actualValue = this.extractEnvironmentVariable(tr.stdout, variableName);
        assert(actualValue !== null, `Environment variable ${variableName} should have been set`);
        if (expectedValue !== undefined) {
            assert.strictEqual(actualValue, expectedValue, `Environment variable ${variableName} should have value "${expectedValue}" but got "${actualValue}"`);
        }
    }
    /**
     * Assert that an environment variable was NOT set
     * @param tr Test runner instance
     * @param variableName Name of the variable to check
     */
    static assertEnvironmentVariableNotSet(tr, variableName) {
        const actualValue = this.extractEnvironmentVariable(tr.stdout, variableName);
        assert(actualValue === null, `Environment variable ${variableName} should not have been set but got value: ${actualValue}`);
    }
    /**
     * Assert that a value was marked as secret
     * @param tr Test runner instance
     * @param secretValue The value that should be marked as secret (optional - just checks setsecret was called)
     */
    static assertMarkedAsSecret(tr, secretValue) {
        assert(tr.stdout.indexOf('##vso[task.setsecret]') > 0, 'Should mark value as secret using task.setsecret command');
        // Note: Secret values are typically redacted from output after being marked, 
        // so we can't reliably check if the specific value appears
    }
}
exports.TestHelpers = TestHelpers;
