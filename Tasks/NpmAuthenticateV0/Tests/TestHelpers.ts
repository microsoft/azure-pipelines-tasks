import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars, TestData } from './TestConstants';

/**
 * Helpers for NpmAuthenticateV0 L0 tests.
 * Manages temp .npmrc lifecycle and provides assertion utilities.
 */
export class TestHelpers {
    // Track temp dirs created during a test so afterEach can clean them up
    private static _tempDirs: string[] = [];

    /**
     * Create a temporary directory tracked for cleanup in afterEach().
     */
    static createTempDir(prefix: string = 'npm-auth-tmpdir-'): string {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
        this._tempDirs.push(tmpDir);
        return tmpDir;
    }

    /**
     * Create a temporary .npmrc file with the given content.
     * The directory is tracked and removed in afterEach().
     */
    static createTempNpmrc(content: string = ''): string {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-auth-test-'));
        this._tempDirs.push(tmpDir);
        const npmrcPath = path.join(tmpDir, '.npmrc');
        fs.writeFileSync(npmrcPath, content, 'utf8');
        return npmrcPath;
    }

    static beforeEach(): void {
        // Clear all test configuration environment variables
        Object.values(TestEnvVars).forEach(v => delete process.env[v]);
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['AGENT_BUILDDIRECTORY'];
        delete process.env['SYSTEM_DEBUG'];
        delete process.env['SAVE_NPMRC_PATH'];
        delete process.env['NPM_AUTHENTICATE_TEMP_DIRECTORY'];
        delete process.env['EXISTING_ENDPOINTS'];
    }

    static afterEach(): void {
        // Clear test env vars
        Object.values(TestEnvVars).forEach(v => delete process.env[v]);
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['AGENT_BUILDDIRECTORY'];
        delete process.env['SYSTEM_DEBUG'];
        delete process.env['SAVE_NPMRC_PATH'];
        delete process.env['NPM_AUTHENTICATE_TEMP_DIRECTORY'];
        delete process.env['EXISTING_ENDPOINTS'];
        // Remove any temp directories created during the test
        for (const dir of this._tempDirs) {
            try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
        }
        this._tempDirs = [];
    }

    static assertSuccess(tr: ttm.MockTestRunner, message?: string): void {
        assert(tr.succeeded, message || `Task should have succeeded.\nStdout: ${tr.stdout}\nStderr: ${tr.stderr}`);
    }

    static assertFailure(tr: ttm.MockTestRunner, message?: string): void {
        assert(tr.failed, message || `Task should have failed.\nStdout: ${tr.stdout}\nStderr: ${tr.stderr}`);
    }

    static assertOutputContains(tr: ttm.MockTestRunner, expected: string, message?: string): void {
        assert(
            tr.stdout.includes(expected),
            message || `Output should contain "${expected}".\nGot: ${tr.stdout}`
        );
    }

    static assertOutputNotContains(tr: ttm.MockTestRunner, unexpected: string, message?: string): void {
        assert(
            !tr.stdout.includes(unexpected),
            message || `Output should NOT contain "${unexpected}".\nGot: ${tr.stdout}`
        );
    }

    static assertWarningIssue(tr: ttm.MockTestRunner, expectedSubstring: string, message?: string): void {
        const found = tr.warningIssues.some(w => w.includes(expectedSubstring));
        assert(
            found,
            message || `Expected a warning containing "${expectedSubstring}".\nWarnings: ${JSON.stringify(tr.warningIssues)}`
        );
    }

    /**
     * Return all auth strings that the mock appendToNpmrc captured.
     * The TestSetup logs each call as "APPEND_TO_NPMRC:<authContent>".
     */
    static getAppendedAuth(tr: ttm.MockTestRunner): string[] {
        return tr.stdout
            .split('\n')
            .filter(l => l.startsWith(TestData.appendPrefix))
            .map(l => l.substring(TestData.appendPrefix.length).trim());
    }

    /**
     * Assert that appendToNpmrc was called at least once and that at least
     * one of the captured auth strings includes the expected substring.
     */
    static assertAuthAppended(tr: ttm.MockTestRunner, expectedSubstring: string, message?: string): void {
        const appended = this.getAppendedAuth(tr);
        assert(
            appended.length > 0,
            `appendToNpmrc should have been called at least once.\nStdout: ${tr.stdout}`
        );
        const found = appended.some(a => a.includes(expectedSubstring));
        assert(
            found,
            message || `None of the appended auth strings contain "${expectedSubstring}".\nAppended: ${JSON.stringify(appended)}`
        );
    }

    /**
     * Assert that appendToNpmrc was never called (no auth was written).
     */
    static assertNoAuthAppended(tr: ttm.MockTestRunner, message?: string): void {
        const appended = this.getAppendedAuth(tr);
        assert.strictEqual(
            appended.length, 0,
            message || `appendToNpmrc should not have been called but got: ${JSON.stringify(appended)}`
        );
    }

    /**
     * Assert that the .npmrc file on disk contains the expected string.
     * Use this to validate that the correct auth was physically written to the file.
     */
    static assertNpmrcContains(npmrcPath: string, expected: string, message?: string): void {
        const content = fs.readFileSync(npmrcPath, 'utf8');
        assert(
            content.includes(expected),
            message || `Expected .npmrc to contain "${expected}".\nActual content:\n${content}`
        );
    }

    /**
     * Assert that the .npmrc file on disk does NOT contain the given string.
     */
    static assertNpmrcNotContains(npmrcPath: string, unexpected: string, message?: string): void {
        const content = fs.readFileSync(npmrcPath, 'utf8');
        assert(
            !content.includes(unexpected),
            message || `Expected .npmrc NOT to contain "${unexpected}".\nActual content:\n${content}`
        );
    }

    /**
     * Build the localRegistries JSON for TestEnvVars.localRegistries.
     * Each entry maps to a {url, auth} object the mock returns from getLocalNpmRegistries.
     */
    static buildLocalRegistry(url: string, authToken: string): object {
        const nerfDart = url.replace(/^https?:/, '');
        return { url, auth: `${nerfDart}:_authToken=${authToken}` };
    }
}
