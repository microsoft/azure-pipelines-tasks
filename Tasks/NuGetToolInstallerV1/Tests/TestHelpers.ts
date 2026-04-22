import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';

/**
 * Shared test setup, teardown, and utility functions for NuGetToolInstallerV1 tests
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
        delete process.env['SYSTEM_DEBUG'];
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
     */
    static async runTest(
        envVars: { [key: string]: string }
    ): Promise<ttm.MockTestRunner> {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

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
    static assertTelemetryEmitted(tr: ttm.MockTestRunner): void {
        assert(tr.stdout.indexOf('Telemetry emitted:') >= 0,
            'Should emit telemetry');
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
