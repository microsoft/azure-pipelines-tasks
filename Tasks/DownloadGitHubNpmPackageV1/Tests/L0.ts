import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadGitHubNpmPackage L0 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT as string) || 20000);

    const setupPath = path.join(__dirname, 'TestSetup.js');
    const taskJsonPath = path.join(__dirname, '..', 'task.json');
    let tempDir: string;
    let npmrcPath: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghnpm-'));
        npmrcPath = path.join(tempDir, '.npmrc');
        process.env['TEST_NPMRC_PATH'] = npmrcPath;
    });

    afterEach(() => {
        delete process.env['TEST_NPMRC_PATH'];
        delete process.env['TEST_NPM_SHOULD_FAIL'];
        delete process.env['TEST_PACKAGE_NAME'];
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    async function runTask(): Promise<ttm.MockTestRunner> {
        const tr = new ttm.MockTestRunner(setupPath, taskJsonPath);
        await tr.runAsync();
        return tr;
    }

    it('removes the temp npmrc after a successful install', async () => {
        const tr = await runTask();

        assert(tr.succeeded, tr.stdout);
        assert(tr.stdout.includes('TEST_NPMRC_WRITTEN'), 'npmrc with token should exist while npm runs');
        assert(tr.stdout.includes('##vso[task.setsecret]'), 'token should be registered as a secret');
        assert(!fs.existsSync(npmrcPath), 'temp npmrc should be removed');
    });

    it('removes the temp npmrc when npm install fails', async () => {
        process.env['TEST_NPM_SHOULD_FAIL'] = 'true';

        const tr = await runTask();

        assert(tr.failed, tr.stdout);
        assert(tr.stdout.includes('TEST_NPMRC_WRITTEN'), 'npmrc with token should exist while npm runs');
        assert(!fs.existsSync(npmrcPath), 'temp npmrc should be removed');
    });

    it('does not leave a temp npmrc when input validation fails', async () => {
        process.env['TEST_PACKAGE_NAME'] = 'invalid-package-name';

        const tr = await runTask();

        assert(tr.failed, tr.stdout);
        assert(tr.stdout.includes('loc_mock_Error_InvalidPackageName'), tr.stdout);
        assert(!fs.existsSync(npmrcPath), 'temp npmrc should not exist');
    });
});
