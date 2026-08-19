import * as path from 'path';
import * as assert from 'assert';
import * as tl from 'azure-pipelines-task-lib/task';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';

const tempDir = path.join(__dirname, 'temp');
const rootDir = path.join(__dirname, 'out');
const destinationDir = path.join(rootDir, 'packageOutput');

/**
 * Shared test setup, teardown, and utility functions for DownloadPackageV1 tests
 */
export class TestHelpers {
    /**
     * Clears all test configuration environment variables before each test
     */
    static beforeEach(): void {
        Object.keys(testConstants.TestEnvVars).forEach(k => {
            delete process.env[testConstants.TestEnvVars[k]];
        });
        tl.mkdirP(destinationDir);
        tl.mkdirP(tempDir);
    }

    /**
     * Cleans up directories and environment variables after each test
     */
    static afterEach(): void {
        tl.rmRF(rootDir);
        tl.rmRF(tempDir);
        delete process.env['AGENT_TEMPDIRECTORY'];
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['AGENT_VERSION'];
        delete process.env['HOME'];
        delete process.env['PACKAGING_SKIPDOWNLOAD'];
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

    /** Get temp directory */
    static get tempDir(): string { return tempDir; }

    /** Get destination directory */
    static get destinationDir(): string { return destinationDir; }

    /**
     * Assert that the task succeeded
     */
    static assertSuccess(tr: ttm.MockTestRunner, expectedMessage?: string): void {
        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stderr.length === 0, 'Should not have written to stderr');

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
     * Assert that a file was downloaded to the temp directory
     */
    static assertFileDownloaded(fileName: string): void {
        const filePath = path.join(tempDir, fileName);
        const stats = tl.stats(filePath);
        assert(stats && stats.isFile(), `${fileName} should be downloaded to temp directory`);
    }

    /**
     * Assert that a file was downloaded directly to destination
     */
    static assertFileInDestination(fileName: string): void {
        const filePath = path.join(destinationDir, fileName);
        const stats = tl.stats(filePath);
        assert(stats && stats.isFile(), `${fileName} should be in destination directory`);
    }

    /**
     * Assert that a file was extracted to destination
     */
    static assertFileExtracted(fileName: string): void {
        const filePath = path.join(destinationDir, fileName);
        const stats = tl.stats(filePath);
        assert(stats && stats.isFile(), `${fileName} should be extracted to destination`);
    }

    /**
     * Assert that a file does NOT exist at a path
     */
    static assertFileNotExists(dirPath: string, fileName: string): void {
        const filePath = path.join(dirPath, fileName);
        const exists = tl.exist(filePath);
        assert(!exists, `${fileName} should not exist in ${dirPath}`);
    }

    /**
     * Assert the number of files in a directory
     */
    static assertFileCount(dirPath: string, expectedCount: number): void {
        const files = tl.ls(null, [dirPath]);
        assert.equal(files.length, expectedCount, `Should have ${expectedCount} file(s) in ${dirPath}`);
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
