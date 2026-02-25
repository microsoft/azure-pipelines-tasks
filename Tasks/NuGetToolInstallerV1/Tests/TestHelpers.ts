// Test helpers for NuGetToolInstallerV1 L0 tests
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

export class TestHelpers {
    static beforeEach() {
        // Clear environment variables before each test
        Object.keys(process.env).forEach(key => {
            if (key.startsWith('__')) {
                delete process.env[key];
            }
        });
    }

    static afterEach() {
        // Clean up after each test
        Object.keys(process.env).forEach(key => {
            if (key.startsWith('__')) {
                delete process.env[key];
            }
        });
    }

    static assertSuccess(tr: ttm.MockTestRunner, message?: string) {
        assert(tr.succeeded, message || `Task should have succeeded. Output: ${tr.stdout}\nErrors: ${tr.stderr}`);
        assert.strictEqual(tr.warningIssues.length, 0, 'Should have no warnings');
        assert.strictEqual(tr.errorIssues.length, 0, 'Should have no errors');
    }

    static assertFailed(tr: ttm.MockTestRunner, message?: string) {
        assert(tr.failed, message || `Task should have failed. Output: ${tr.stdout}`);
    }

    static assertOutputContains(tr: ttm.MockTestRunner, expectedString: string, message?: string) {
        const output = tr.stdout + tr.stderr;
        assert(
            output.indexOf(expectedString) >= 0,
            message || `Output should contain: ${expectedString}\nActual output: ${output}`
        );
    }

    static assertOutputDoesNotContain(tr: ttm.MockTestRunner, unexpectedString: string, message?: string) {
        const output = tr.stdout + tr.stderr;
        assert(
            output.indexOf(unexpectedString) < 0,
            message || `Output should not contain: ${unexpectedString}\nActual output: ${output}`
        );
    }
}
