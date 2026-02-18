import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';

export class TestHelpers {
    /**
     * Clear all test environment variables before each test
     */
    static beforeEach(): void {
        // Clear all test configuration environment variables
        Object.values(testConstants.TestEnvVars).forEach(envVar => {
            delete process.env[envVar];
        });
        
        // Clear mock control flags
        delete process.env['__throwTelemetryError__'];
        delete process.env['__mockServiceConnections__'];
    }

    /**
     * Clean up actual environment variables after each test
     */
    static afterEach(): void {
        // Clean up actual environment variables that might be set by the task
        delete process.env['VSS_NUGET_EXTERNAL_FEED_ENDPOINTS'];
        delete process.env['VSS_NUGET_URI_PREFIXES'];
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['SYSTEM_DEBUG'];
        delete process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'];
        delete process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'];
    }

    /**
     * Setup basic successful authentication scenario
     */
    static setupBasicAuth(): void {
        process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
        process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
    }

    /**
     * Setup WIF authentication scenario
     */
    static setupWifAuth(feedUrl?: string): void {
        process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
        process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
        if (feedUrl) {
            process.env[testConstants.TestEnvVars.feedUrl] = feedUrl;
        }
    }

    /**
     * Setup external service connections
     */
    static setupExternalServiceConnections(connections: any[]): void {
        process.env['__mockServiceConnections__'] = JSON.stringify(connections);
    }

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
     * @param secretValue The value that should be marked as secret (optional - just checks setsecret was called)
     */
    static assertMarkedAsSecret(tr: ttm.MockTestRunner, secretValue?: string): void {
        assert(tr.stdout.indexOf('##vso[task.setsecret]') > 0,
            'Should mark value as secret using task.setsecret command');
        // Note: Secret values are typically redacted from output after being marked, 
        // so we can't reliably check if the specific value appears
    }

    /**
     * Assert that task succeeded
     * @param tr Test runner instance
     */
    static assertSuccess(tr: ttm.MockTestRunner): void {
        assert(tr.succeeded, 'Task should have succeeded');
        assert.strictEqual(tr.errorIssues.length, 0, 'Should have no error issues');
    }

    /**
     * Assert that task failed
     * @param tr Test runner instance
     */
    static assertFailure(tr: ttm.MockTestRunner): void {
        assert(tr.failed, 'Task should have failed');
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
