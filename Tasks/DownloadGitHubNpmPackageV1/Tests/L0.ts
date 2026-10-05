import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import { getNpmArguments, setNpmArguments } from '../npmarguments';

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

describe('DownloadGitHubNpmPackageV1 arguments', function () {
    const packageDownloadPath = 'C:\\agent\\_work\\1\\shared-library';
    const packageName = 'contoso/shared-library';

    it('creates the expected arguments for a package without a version', function () {
        assert.deepStrictEqual(
            getNpmArguments(packageDownloadPath, packageName, ''),
            ['install', '--prefix', packageDownloadPath, '@contoso/shared-library']
        );
    });

    const validVersions = [
        '1.0.0',
        '1.0.0-beta.1',
        '1.0.0+build.5',
        'latest',
        '>=1.0.0 <2.0.0'
    ];

    for (const version of validVersions) {
        it(`keeps version '${version}' in one package argument`, function () {
            const argumentsList = getNpmArguments(packageDownloadPath, packageName, version);

            assert.strictEqual(argumentsList.length, 4);
            assert.deepStrictEqual(argumentsList.slice(0, 3), ['install', '--prefix', packageDownloadPath]);
            assert.strictEqual(argumentsList[3], `@contoso/shared-library@${version}`);
        });
    }

    const injectionAttempts = [
        '1.0.0 --registry https://example.invalid/',
        '1.0.0 --prefix C:\\attacker-controlled',
        '1.0.0 another-package',
        '1.0.0\t--registry\thttps://example.invalid/',
        '1.0.0\r\n--registry https://example.invalid/',
        '1.0.0 "--registry" "https://example.invalid/"',
        "1.0.0 '--registry' 'https://example.invalid/'"
    ];

    for (const version of injectionAttempts) {
        it(`does not split untrusted version '${JSON.stringify(version)}'`, function () {
            const argumentsList = getNpmArguments(packageDownloadPath, packageName, version);

            assert.strictEqual(argumentsList.length, 4);
            assert.strictEqual(argumentsList[3], `@contoso/shared-library@${version}`);
            assert.strictEqual(argumentsList.includes('--registry'), false);
            assert.strictEqual(argumentsList.includes('--prefix', 3), false);
            assert.strictEqual(argumentsList.includes('another-package'), false);
        });
    }

    it('does not split an option-looking package name', function () {
        const optionLookingPackageName = 'contoso/shared-library --registry https://example.invalid/';
        const argumentsList = getNpmArguments(packageDownloadPath, optionLookingPackageName, '1.0.0');

        assert.strictEqual(argumentsList.length, 4);
        assert.strictEqual(
            argumentsList[3],
            '@contoso/shared-library --registry https://example.invalid/@1.0.0'
        );
        assert.strictEqual(argumentsList.includes('--registry'), false);
    });

    it('uses discrete arguments when the feature flag is enabled', function () {
        const argumentsList: string[] = [];
        let commandLine: string | undefined;

        setNpmArguments(
            {
                arg: argument => argumentsList.push(argument),
                line: command => commandLine = command
            },
            packageDownloadPath,
            packageName,
            '1.0.0 --registry https://example.invalid/',
            true
        );

        assert.deepStrictEqual(
            argumentsList,
            [
                'install',
                '--prefix',
                packageDownloadPath,
                '@contoso/shared-library@1.0.0 --registry https://example.invalid/'
            ]
        );
        assert.strictEqual(commandLine, undefined);
    });

    it('uses the legacy command line when the feature flag is disabled', function () {
        const argumentsList: string[] = [];
        let commandLine: string | undefined;

        setNpmArguments(
            {
                arg: argument => argumentsList.push(argument),
                line: command => commandLine = command
            },
            packageDownloadPath,
            packageName,
            '1.0.0',
            false
        );

        assert.deepStrictEqual(argumentsList, []);
        assert.strictEqual(
            commandLine,
            `install --prefix ${packageDownloadPath} @contoso/shared-library@1.0.0`
        );
    });
});
