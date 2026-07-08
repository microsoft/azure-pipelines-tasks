import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';

/**
 * Shared test setup, teardown, and utility functions for NuGetToolInstallerV0 tests
 */
export class TestHelpers {
    /**
     * Clears all test configuration environment variables before each test
     */
    static beforeEach(): void {
        Object.keys(testConstants.TestEnvVars).forEach(k => {
            delete process.env[testConstants.TestEnvVars[k]];
        });
        delete process.env['NUGET_EXE_TOOL_PATH'];
    }

    /**
     * Cleans up environment variables after each test
     */
    static afterEach(): void {
        delete process.env['NUGET_EXE_TOOL_PATH'];
        delete process.env['SYSTEM_DEBUG'];
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
     */
    static assertSuccess(tr: ttm.MockTestRunner, expectedMessage?: string): void {
        assert(tr.succeeded, 'Task should have succeeded');
        assert.strictEqual(tr.errorIssues.length, 0, 'Should have no error issues');

        if (expectedMessage) {
            assert(tr.stdout.indexOf(expectedMessage) >= 0,
                `Output should contain: ${expectedMessage}`);
        }
    }

    /**
     * Assert that the task failed
     */
    static assertFailure(tr: ttm.MockTestRunner, expectedError?: string): void {
        assert(tr.failed, 'Task should have failed');

        if (expectedError) {
            assert(tr.stdout.indexOf(expectedError) >= 0,
                `Output should contain error: ${expectedError}`);
        }
    }

    /**
     * Assert that telemetry was emitted
     */
    static assertTelemetryEmitted(tr: ttm.MockTestRunner, expectedData?: { [key: string]: any }): void {
        assert(tr.stdout.indexOf('Telemetry emitted:') >= 0,
            'Should emit telemetry');

        if (expectedData) {
            Object.keys(expectedData).forEach(key => {
                const pattern = `"${key}":"${expectedData[key]}"`;
                const patternSpaced = `"${key}": "${expectedData[key]}"`;
                assert(tr.stdout.indexOf(pattern) >= 0 || tr.stdout.indexOf(patternSpaced) >= 0,
                    `Telemetry should contain ${key}:${expectedData[key]}`);
            });
        }
    }

    /**
     * Assert that stdout contains a specific string
     */
    static assertStdoutContains(tr: ttm.MockTestRunner, expectedString: string, message?: string): void {
        assert(tr.stdout.indexOf(expectedString) >= 0,
            message || `Output should contain: ${expectedString}`);
    }

    /**
     * Assert that stdout does not contain a specific string
     */
    static assertStdoutDoesNotContain(tr: ttm.MockTestRunner, unexpectedString: string, message?: string): void {
        assert(tr.stdout.indexOf(unexpectedString) < 0,
            message || `Output should not contain: ${unexpectedString}`);
    }
}
