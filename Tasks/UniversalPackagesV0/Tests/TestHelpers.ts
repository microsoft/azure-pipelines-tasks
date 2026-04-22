import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';

/**
 * Shared test setup, teardown, and utility functions for Universal Packages tests
 */
export class TestHelpers {
    /**
     * Clears all test configuration environment variables before each test
     */
    static beforeEach(): void {
        Object.values(testConstants.TestEnvVars).forEach(key => {
            delete process.env[key];
        });
        delete process.env['VSTS_TASKVARIABLE_UPACK_ARTIFACTTOOL_PATH'];
        delete process.env['UPACK_ARTIFACTTOOL_PATH_CACHED'];
    }

    /**
     * Cleans up environment variables after each test
     */
    static afterEach(): void {
        TestHelpers.beforeEach();
    }

    /**
     * Run a test with environment setup using the shared TestSetup
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
     * Run a pre-job test with environment setup using PreJobTestSetup
     * @param envVars Environment variables to set for the test
     * @returns MockTestRunner instance after execution
     */
    static async runPreJobTest(
        envVars: { [key: string]: string }
    ): Promise<ttm.MockTestRunner> {
        const tp = path.join(__dirname, 'PreJobTestSetup.js');
        const tr = new ttm.MockTestRunner(tp);

        // Set environment variables
        Object.keys(envVars).forEach(key => {
            process.env[key] = envVars[key];
        });

        await tr.runAsync();
        return tr;
    }

    /**
     * Assert that the task succeeded with no errors
     */
    static assertSuccess(tr: ttm.MockTestRunner): void {
        assert(tr.succeeded, 'Task should have succeeded');
        assert.strictEqual(tr.errorIssues.length, 0, 'Should have no error issues');
    }

    /**
     * Assert that the task failed
     */
    static assertFailure(tr: ttm.MockTestRunner): void {
        assert(tr.failed, 'Task should have failed');
    }

    /**
     * Assert that stdout contains a specific message
     */
    static assertStdoutContains(tr: ttm.MockTestRunner, message: string, description?: string): void {
        assert(
            tr.stdOutContained(message),
            description || `Output should contain: "${message}"`
        );
    }

    /**
     * Assert that a specific ArtifactTool command was executed
     */
    static assertRanCommand(tr: ttm.MockTestRunner, command: string): void {
        assert(tr.ran(command), `Should have run command: ${command}`);
    }

    /**
     * Assert that ArtifactTool was invoked a specific number of times
     */
    static assertToolInvocationCount(tr: ttm.MockTestRunner, count: number): void {
        assert.strictEqual(tr.invokedToolCount, count, `Should have invoked tool ${count} time(s)`);
    }

    /**
     * Build expected ArtifactTool download command string
     */
    static buildDownloadCommand(options: {
        feed: string;
        packageName: string;
        packageVersion: string;
        downloadPath: string;
        service?: string;
        project?: string;
    }): string {
        const service = options.service || testConstants.TestData.defaultServiceUri;
        let cmd = `${testConstants.TestData.artifactToolCmd} universal download` +
            ` --feed ${options.feed}` +
            ` --service ${service}` +
            ` --package-name ${options.packageName}` +
            ` --package-version ${options.packageVersion}` +
            ` --path ${options.downloadPath}` +
            ` --patvar UNIVERSAL_DOWNLOAD_PAT` +
            ` --verbosity verbose`;

        if (options.project) {
            cmd += ` --project ${options.project}`;
        }

        return cmd;
    }
}
