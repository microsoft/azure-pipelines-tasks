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
     * Return auth lines from the .npmrc file that contain _authToken, _password, or always-auth.
     * Reads the actual file on disk — works with both the old mock and the inlined writeFile approach.
     */
    static getAppendedAuth(tr: ttm.MockTestRunner, npmrcPath?: string): string[] {
        // Try the npmrcPath passed explicitly, or fall back to the env var
        const filePath = npmrcPath || process.env[TestEnvVars.npmrcPath] || '';
        if (!filePath || !fs.existsSync(filePath)) {
            return [];
        }
        const content = fs.readFileSync(filePath, 'utf8');
        return content
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.includes('_authToken=') || l.includes('_password=') || l.includes('always-auth='));
    }

    /**
     * Assert that auth was written to the .npmrc file and contains the expected substring.
     */
    static assertAuthAppended(tr: ttm.MockTestRunner, expectedSubstring: string, message?: string): void {
        const npmrcFilePath = process.env[TestEnvVars.npmrcPath] || '';
        assert(npmrcFilePath, 'npmrcPath must be set to check appended auth');
        const content = fs.readFileSync(npmrcFilePath, 'utf8');
        assert(
            content.includes(expectedSubstring),
            message || `Expected .npmrc to contain "${expectedSubstring}" after auth was appended.\nActual content:\n${content}`
        );
    }

    /**
     * Assert that no auth was written to the .npmrc file.
     */
    static assertNoAuthAppended(tr: ttm.MockTestRunner, message?: string): void {
        const npmrcFilePath = process.env[TestEnvVars.npmrcPath] || '';
        if (!npmrcFilePath || !fs.existsSync(npmrcFilePath)) {
            return; // file doesn't exist — nothing was appended
        }
        const content = fs.readFileSync(npmrcFilePath, 'utf8');
        assert(
            !content.includes('_authToken='),
            message || `Expected no auth to be written but .npmrc contains _authToken.\nContent:\n${content}`
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
