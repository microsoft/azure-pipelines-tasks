import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

/**
 * Helper methods for CondaAuthenticateV0 tests
 */
export class TestHelpers {
    /**
     * Extract environment variable value from task output
     * Parses ##vso[task.setvariable variable=NAME]VALUE format
     * @param stdout Task stdout
     * @param variableName Name of the variable to extract
     * @returns Variable value or null if not found
     */
    static extractEnvironmentVariable(stdout: string, variableName: string): string | null {
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
    static assertEnvironmentVariableSet(
        tr: ttm.MockTestRunner,
        variableName: string,
        expectedValue?: string
    ): void {
        const actualValue = this.extractEnvironmentVariable(tr.stdout, variableName);
        
        assert(actualValue !== null, 
            `Environment variable ${variableName} should have been set`);
        
        if (expectedValue !== undefined) {
            assert.strictEqual(actualValue, expectedValue,
                `Environment variable ${variableName} should have value "${expectedValue}" but got "${actualValue}"`);
        }
    }

    /**
     * Assert that an environment variable was NOT set
     * @param tr Test runner instance
     * @param variableName Name of the variable to check
     */
    static assertEnvironmentVariableNotSet(
        tr: ttm.MockTestRunner,
        variableName: string
    ): void {
        const actualValue = this.extractEnvironmentVariable(tr.stdout, variableName);
        
        assert(actualValue === null,
            `Environment variable ${variableName} should not have been set but got value: ${actualValue}`);
    }

    /**
     * Assert that a value was marked as secret
     * @param tr Test runner instance
     * @param secretValue The value that should be marked as secret
     */
    static assertMarkedAsSecret(tr: ttm.MockTestRunner, secretValue: string): void {
        assert(tr.stdout.indexOf('##vso[task.setsecret]') > 0,
            'Should mark value as secret using task.setsecret command');
        assert(tr.stdout.indexOf(secretValue) > 0,
            `Secret value "${secretValue}" should appear in setsecret command`);
    }

    /**
     * Assert that task succeeded
     * @param tr Test runner instance
     * @param message Optional message for assertion
     */
    static assertSuccess(tr: ttm.MockTestRunner, message?: string): void {
        assert(tr.succeeded, message || 'Task should have succeeded');
        assert.strictEqual(tr.errorIssues.length, 0, 'Should have no error issues');
    }

    /**
     * Assert that task failed
     * @param tr Test runner instance
     * @param message Optional message for assertion
     */
    static assertFailure(tr: ttm.MockTestRunner, message?: string): void {
        assert(tr.failed, message || 'Task should have failed');
    }

    /**
     * Assert that output contains expected string
     * @param tr Test runner instance
     * @param expectedString String to search for
     * @param message Optional message for assertion
     */
    static assertOutputContains(tr: ttm.MockTestRunner, expectedString: string, message?: string): void {
        assert(tr.stdout.indexOf(expectedString) > 0,
            message || `Output should contain: ${expectedString}`);
    }

    /**
     * Assert that output does NOT contain string
     * @param tr Test runner instance
     * @param unexpectedString String that should not appear
     * @param message Optional message for assertion
     */
    static assertOutputNotContains(tr: ttm.MockTestRunner, unexpectedString: string, message?: string): void {
        assert(tr.stdout.indexOf(unexpectedString) < 0,
            message || `Output should not contain: ${unexpectedString}`);
    }
}
