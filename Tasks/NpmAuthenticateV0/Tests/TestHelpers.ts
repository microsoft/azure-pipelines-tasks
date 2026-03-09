import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars, TestData } from './TestConstants';

export class TestHelpers {
    private static _tempDirs: string[] = [];

    static createTempDir(prefix: string = 'npm-auth-tmpdir-'): string {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
        this._tempDirs.push(tmpDir);
        return tmpDir;
    }

    static createTempNpmrc(content: string = ''): string {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-auth-test-'));
        this._tempDirs.push(tmpDir);
        const npmrcPath = path.join(tmpDir, '.npmrc');
        fs.writeFileSync(npmrcPath, content, 'utf8');
        return npmrcPath;
    }

    static beforeEach(): void {
        Object.values(TestEnvVars).forEach(v => delete process.env[v]);
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['AGENT_BUILDDIRECTORY'];
        delete process.env['SYSTEM_DEBUG'];
        delete process.env['SAVE_NPMRC_PATH'];
        delete process.env['NPM_AUTHENTICATE_TEMP_DIRECTORY'];
        delete process.env['EXISTING_ENDPOINTS'];
    }

    static afterEach(): void {
        Object.values(TestEnvVars).forEach(v => delete process.env[v]);
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['AGENT_BUILDDIRECTORY'];
        delete process.env['SYSTEM_DEBUG'];
        delete process.env['SAVE_NPMRC_PATH'];
        delete process.env['NPM_AUTHENTICATE_TEMP_DIRECTORY'];
        delete process.env['EXISTING_ENDPOINTS'];
        for (const dir of this._tempDirs) {
            try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
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
        assert(tr.stdout.includes(expected),
            message || `Output should contain "${expected}".\nGot: ${tr.stdout}`);
    }

    static assertOutputNotContains(tr: ttm.MockTestRunner, unexpected: string, message?: string): void {
        assert(!tr.stdout.includes(unexpected),
            message || `Output should NOT contain "${unexpected}".\nGot: ${tr.stdout}`);
    }

    static assertWarningIssue(tr: ttm.MockTestRunner, expectedSubstring: string, message?: string): void {
        const found = tr.warningIssues.some(w => w.includes(expectedSubstring));
        assert(found,
            message || `Expected a warning containing "${expectedSubstring}".\nWarnings: ${JSON.stringify(tr.warningIssues)}`);
    }

    static getAppendedAuth(tr: ttm.MockTestRunner, npmrcPath?: string): string[] {
        const filePath = npmrcPath || process.env[TestEnvVars.npmrcPath] || '';
        if (!filePath || !fs.existsSync(filePath)) {
            return [];
        }
        return fs.readFileSync(filePath, 'utf8')
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.includes('_authToken=') || l.includes('_password=') || l.includes('always-auth='));
    }

    static assertAuthAppended(tr: ttm.MockTestRunner, expectedSubstring: string, message?: string): void {
        const npmrcFilePath = process.env[TestEnvVars.npmrcPath] || '';
        assert(npmrcFilePath, 'npmrcPath must be set to check appended auth');
        const content = fs.readFileSync(npmrcFilePath, 'utf8');
        assert(content.includes(expectedSubstring),
            message || `Expected .npmrc to contain "${expectedSubstring}".\nContent:\n${content}`);
    }

    static assertNoAuthAppended(tr: ttm.MockTestRunner, message?: string): void {
        const npmrcFilePath = process.env[TestEnvVars.npmrcPath] || '';
        if (!npmrcFilePath || !fs.existsSync(npmrcFilePath)) {
            return;
        }
        const content = fs.readFileSync(npmrcFilePath, 'utf8');
        assert(!content.includes('_authToken='),
            message || `Expected no auth but .npmrc contains _authToken.\nContent:\n${content}`);
    }

    static assertNpmrcContains(npmrcPath: string, expected: string, message?: string): void {
        const content = fs.readFileSync(npmrcPath, 'utf8');
        assert(content.includes(expected),
            message || `Expected .npmrc to contain "${expected}".\nActual content:\n${content}`);
    }

    static assertNpmrcNotContains(npmrcPath: string, unexpected: string, message?: string): void {
        const content = fs.readFileSync(npmrcPath, 'utf8');
        assert(!content.includes(unexpected),
            message || `Expected .npmrc NOT to contain "${unexpected}".\nActual content:\n${content}`);
    }

    static buildLocalRegistry(url: string, authToken: string): object {
        const nerfDart = url.replace(/^https?:/, '');
        return { url, auth: `${nerfDart}:_authToken=${authToken}` };
    }
}
