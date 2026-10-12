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
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ttm = require("azure-pipelines-task-lib/mock-test");
const testConstants = require("./TestConstants");
const pypircPath = path.join(__dirname, 'temp', '.pypirc');
/**
 * Helper methods for TwineAuthenticateV1 tests
 * Provides centralized test lifecycle management and assertion utilities
 */
class TestHelpers {
    /**
     * Common setup before each test
     * Clears environment variables to ensure test isolation
     */
    static beforeEach() {
        // Clear all test configuration environment variables
        Object.values(testConstants.TestEnvVars).forEach(envVar => {
            delete process.env[envVar];
        });
        // Clear system environment variables
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['SYSTEM_DEBUG'];
        // Clear pypirc-specific environment variables
        delete process.env['PYPIRC_PATH'];
        // Remove any .pypirc left over from a previous test so content assertions
        // always reflect only the current test's run.
        if (fs.existsSync(pypircPath)) {
            fs.unlinkSync(pypircPath);
        }
    }
    /**
     * Common teardown after each test
     * Cleans up any environment variables that tests might have set
     */
    static afterEach() {
        // Clean up pypirc environment variables
        delete process.env['PYPIRC_PATH'];
        // Clear test configuration env vars
        Object.values(testConstants.TestEnvVars).forEach(envVar => {
            delete process.env[envVar];
        });
        // Clear system environment variables
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['SYSTEM_DEBUG'];
        // Delete the .pypirc written during the test so it cannot bleed into the next test.
        if (fs.existsSync(pypircPath)) {
            fs.unlinkSync(pypircPath);
        }
    }
    /**
     * Run a test with environment setup
     * Provides cleaner test syntax with builder pattern
     * @param envVars Environment variables to set for the test
     * @returns MockTestRunner instance after execution
     */
    static runTest(envVars) {
        return __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            // Set environment variables for this test
            Object.keys(envVars).forEach(key => {
                process.env[key] = envVars[key];
            });
            yield tr.runAsync();
            return tr;
        });
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
    /**
     * Assert that task succeeded
     * @param tr Test runner instance
     * @param message Optional descriptive message for the assertion
     */
    static assertSuccess(tr, message) {
        assert(tr.succeeded, message || 'Task should have succeeded');
        assert.strictEqual(tr.errorIssues.length, 0, 'Should have no error issues');
    }
    /**
     * Assert that task failed
     * @param tr Test runner instance
     */
    static assertFailure(tr) {
        assert(tr.failed, 'Task should have failed');
    }
    /**
     * Assert that output contains expected string
     * @param tr Test runner instance
     * @param expectedString String to search for
     * @param message Optional message for assertion
     */
    static assertOutputContains(tr, expectedString, message) {
        assert(tr.stdout.indexOf(expectedString) > 0, message || `Output should contain: ${expectedString}`);
    }
    /**
     * Assert that output does NOT contain string
     * @param tr Test runner instance
     * @param unexpectedString String that should not appear
     * @param message Optional message for assertion
     */
    static assertOutputNotContains(tr, unexpectedString, message) {
        assert(tr.stdout.indexOf(unexpectedString) < 0, message || `Output should not contain: ${unexpectedString}`);
    }
}
exports.TestHelpers = TestHelpers;
