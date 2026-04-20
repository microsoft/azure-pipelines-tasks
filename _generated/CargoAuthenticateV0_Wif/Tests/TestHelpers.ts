import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';

/**
 * Shared test setup, teardown, and utility functions for consistent test patterns
 */
export class TestHelpers {
    /**
     * Clears all test configuration environment variables before each test
     */
    static beforeEach(): void {
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
    static afterEach(): void {
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
    static async runTest(
        envVars: { [key: string]: string }
    ): Promise<ttm.MockTestRunner> {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);
        
        // Set environment variables
        Object.keys(envVars).forEach(key => {
            process.env[key] = envVars[key];
        });
        
        await tr.runAsync();
        return tr;
    }

    /**
     * Assert that the task succeeded
     * @param tr Test runner instance
     * @param expectedMessage Optional message that should appear in stdout
     */
    static assertSuccess(
        tr: ttm.MockTestRunner, 
        expectedMessage?: string
    ): void {
        assert(tr.succeeded, 'Task should have succeeded');
        assert.strictEqual(tr.errorIssues.length, 0, 'Should have no error issues');
        
        if (expectedMessage) {
            assert(tr.stdout.indexOf(expectedMessage) > 0,
                `Output should contain: ${expectedMessage}`);
        }
    }

    /**
     * Assert that the task failed
     * @param tr Test runner instance
     * @param options Failure assertion options
     */
    static assertFailure(
        tr: ttm.MockTestRunner,
        options: {
            expectedError?: string;
            shouldHaveErrors?: boolean;
        } = {}
    ): void {
        const shouldHaveErrors = options.shouldHaveErrors !== undefined ? options.shouldHaveErrors : true;
        
        assert(tr.failed, 'Task should have failed');
        
        if (shouldHaveErrors) {
            assert(tr.errorIssues.length > 0, 'Should have error messages');
        }
        
        if (options.expectedError) {
            assert(tr.stdout.indexOf(options.expectedError) > 0,
                `Output should contain error: ${options.expectedError}`);
        }
    }

    /**
     * Assert that an environment variable was set
     * @param tr Test runner instance
     * @param varName Environment variable name
     * @param shouldBeSecret Whether the variable should be marked as secret
     */
    static assertEnvVarSet(
        tr: ttm.MockTestRunner,
        varName: string,
        shouldBeSecret: boolean = false
    ): void {
        assert(tr.stdout.indexOf(varName) > 0,
            `Should set ${varName} environment variable`);
            
        if (shouldBeSecret) {
            assert(tr.stdout.indexOf('##vso[task.setsecret]') > 0,
                `${varName} should be marked as secret`);
        }
    }

    /**
     * Assert that telemetry was emitted
     * @param tr Test runner instance
     * @param expectedData Optional data to verify in telemetry
     */
    static assertTelemetryEmitted(
        tr: ttm.MockTestRunner,
        expectedData?: { [key: string]: any }
    ): void {
        assert(tr.stdout.indexOf('Telemetry emitted:') > 0,
            'Should emit telemetry');
            
        if (expectedData) {
            Object.keys(expectedData).forEach(key => {
                assert(tr.stdout.indexOf(`"${key}":${expectedData[key]}`) > 0 ||
                       tr.stdout.indexOf(`"${key}": ${expectedData[key]}`) > 0,
                    `Telemetry should contain ${key}:${expectedData[key]}`);
            });
        }
    }

    /**
     * Assert that stdout contains a specific string
     * @param tr Test runner instance
     * @param expectedString String to search for
     * @param message Optional assertion message
     */
    static assertStdoutContains(
        tr: ttm.MockTestRunner,
        expectedString: string,
        message?: string
    ): void {
        assert(tr.stdout.indexOf(expectedString) > 0,
            message || `Output should contain: ${expectedString}`);
    }

    /**
     * Assert that stdout does not contain a specific string
     * @param tr Test runner instance
     * @param unexpectedString String that should not appear
     * @param message Optional assertion message
     */
    static assertStdoutDoesNotContain(
        tr: ttm.MockTestRunner,
        unexpectedString: string,
        message?: string
    ): void {
        assert(tr.stdout.indexOf(unexpectedString) < 0,
            message || `Output should not contain: ${unexpectedString}`);
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
}
