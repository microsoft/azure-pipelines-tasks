import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';

/**
 * Shared test setup, teardown, and utility functions for NuGetV0 tests
 */
export class TestHelpers {
    /**
     * Clears all test configuration environment variables before each test
     */
    static beforeEach(): void {
        delete process.env[testConstants.TestEnvVars.command];
        delete process.env[testConstants.TestEnvVars.arguments];
        delete process.env[testConstants.TestEnvVars.nuGetVersion];
        delete process.env[testConstants.TestEnvVars.nuGetVersionInfo];
        delete process.env[testConstants.TestEnvVars.nuGetExePath];
        delete process.env[testConstants.TestEnvVars.systemAccessToken];
        delete process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri];
        delete process.env[testConstants.TestEnvVars.systemDebug];
        delete process.env[testConstants.TestEnvVars.getNuGetShouldFail];
        delete process.env[testConstants.TestEnvVars.packagingLocationShouldFail];
        delete process.env[testConstants.TestEnvVars.nuGetExitCode];
        delete process.env[testConstants.TestEnvVars.extraUrlPrefixes];
        delete process.env['NUGET_EXE_TOOL_PATH'];
        delete process.env['SYSTEM_DEBUG'];
    }

    /**
     * Cleans up environment variables after each test
     */
    static afterEach(): void {
        delete process.env['AGENT_HOMEDIRECTORY'];
        delete process.env['BUILD_SOURCESDIRECTORY'];
        delete process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'];
        delete process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'];
        delete process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'];
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['NUGET_EXE_TOOL_PATH'];
        delete process.env['NUGETTASKS_EXTRAURLPREFIXESFORTESTING'];
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
     * Assert that NuGet was executed with specific parameters
     */
    static assertNuGetRan(tr: ttm.MockTestRunner, nuGetPath: string, command: string, args?: string): void {
        let expectedCmd = `${nuGetPath} ${command} -NonInteractive`;
        if (args) {
            expectedCmd += ` ${args}`;
        }
        assert(tr.ran(expectedCmd), `NuGet should have run: ${expectedCmd}`);
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

    /**
     * Assert that console code page was set
     */
    static assertCodePageSet(tr: ttm.MockTestRunner): void {
        assert(tr.stdout.indexOf('setting console code page') >= 0,
            'Console code page should have been set');
    }
}
