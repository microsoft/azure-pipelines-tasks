import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import {
    getNpmArguments,
    getValidatedNpmPackageSpec,
    setNpmArguments
} from '../npmarguments';

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
        delete process.env['TEST_FEATURE_ENABLED'];
        delete process.env['TEST_PACKAGE_NAME'];
        delete process.env['TEST_PACKAGE_VERSION'];
        delete process.env['NPM_PACKAGE_VERSION'];
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

    it('rejects a non-registry package specification before writing the temp npmrc', async () => {
        process.env['TEST_FEATURE_ENABLED'] = 'true';
        process.env['TEST_PACKAGE_VERSION'] = 'https://example.invalid/evil.tgz';

        const tr = await runTask();

        assert(tr.failed, tr.stdout);
        assert(tr.stdout.includes('Package version must be a registry version, range, or tag.'), tr.stdout);
        assert(!tr.stdout.includes('TEST_NPMRC_WRITTEN'), 'npm should not run');
        assert(!fs.existsSync(npmrcPath), 'temp npmrc should not exist');
    });

    it('rejects Windows environment expansion before writing the temp npmrc', async () => {
        process.env['TEST_FEATURE_ENABLED'] = 'true';
        process.env['TEST_PACKAGE_VERSION'] = '%NPM_PACKAGE_VERSION%';
        process.env['NPM_PACKAGE_VERSION'] = '1.0.0 --registry https://example.invalid/';

        const tr = await runTask();

        assert(tr.failed, tr.stdout);
        assert(tr.stdout.includes('Package version must be a registry version, range, or tag.'), tr.stdout);
        assert(!tr.stdout.includes('TEST_NPMRC_WRITTEN'), 'npm should not run');
        assert(!fs.existsSync(npmrcPath), 'temp npmrc should not exist');
    });
});

describe('DownloadGitHubNpmPackageV1 arguments', function () {
    const packageDownloadPath = 'C:\\agent\\_work\\1\\shared-library';
    const packageName = 'contoso/shared-library';

    const validVersions = [
        '1.0.0',
        '1.0.0-beta.1',
        '1.0.0+build.5',
        'latest',
        '>=1.0.0 <2.0.0',
        '^1.2.3',
        '~1.2.3',
        '1.x',
        '1.0.0 || 2.0.0',
        '1.0.0 - 2.0.0'
    ];

    for (const version of validVersions) {
        it(`accepts registry version '${version}' as one package argument`, function () {
            const argumentsList = getNpmArguments(packageDownloadPath, packageName, version);

            assert.strictEqual(argumentsList.length, 4);
            assert.deepStrictEqual(argumentsList.slice(0, 3), ['install', '--prefix', packageDownloadPath]);
            assert.strictEqual(argumentsList[3], `@contoso/shared-library@${version}`);
        });
    }

    const invalidVersions = [
        '1.0.0 --registry https://example.invalid/',
        '1.0.0 --prefix C:\\attacker-controlled',
        '1.0.0 another-package',
        '1.0.0\t--registry\thttps://example.invalid/',
        '1.0.0\r\n--registry https://example.invalid/',
        '1.0.0 "--registry" "https://example.invalid/"',
        "1.0.0 '--registry' 'https://example.invalid/'",
        'https://example.invalid/evil.tgz',
        'git+https://example.invalid/repository.git',
        'file:..\\evil',
        '..\\evil',
        '.beta',
        '.\\evil',
        './evil',
        '../evil',
        'evil.tgz',
        'npm:other-package@1.0.0',
        '%NPM_PACKAGE_VERSION%',
        '',
        ' ',
        ' 1.0.0',
        '1.0.0 '
    ];

    for (const version of invalidVersions) {
        it(`rejects non-registry version '${JSON.stringify(version)}'`, function () {
            assert.throws(
                () => getValidatedNpmPackageSpec(packageName, version),
                /Package version must be a registry version, range, or tag/
            );
        });
    }

    it('rejects an invalid scoped package name', function () {
        const optionLookingPackageName = 'contoso/shared-library --registry https://example.invalid/';

        assert.throws(
            () => getNpmArguments(packageDownloadPath, optionLookingPackageName, '1.0.0'),
            /Package name must be a valid scoped npm package name/
        );

        assert.throws(
            () => getNpmArguments(packageDownloadPath, 'contoso/shared-library%PAYLOAD%', '1.0.0'),
            /Package name must be a valid scoped npm package name/
        );
    });

    it('rejects dot path segments in package names', function () {
        for (const name of ['contoso/..', 'contoso/.', '../shared-library']) {
            assert.throws(
                () => getValidatedNpmPackageSpec(name, '1.0.0'),
                /Package name must be a valid scoped npm package name/
            );
        }
    });

    it('accepts npm-compatible scoped package names', function () {
        assert.strictEqual(
            getValidatedNpmPackageSpec('contoso/.shared-library', '1.0.0'),
            '@contoso/.shared-library@1.0.0'
        );
        assert.strictEqual(
            getValidatedNpmPackageSpec('contoso/_shared-library', 'latest'),
            '@contoso/_shared-library@latest'
        );
    });

    it('enforces the 214-character limit on the complete scoped package name', function () {
        const maxLengthPackageName = `contoso/${'p'.repeat(214 - '@contoso/'.length)}`;
        const overLengthPackageName = `${maxLengthPackageName}p`;

        assert.strictEqual(
            getValidatedNpmPackageSpec(maxLengthPackageName, '1.0.0'),
            `@${maxLengthPackageName}@1.0.0`
        );
        assert.throws(
            () => getValidatedNpmPackageSpec(overLengthPackageName, '1.0.0'),
            /Package name must be a valid scoped npm package name/
        );
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
            '>=1.0.0 <2.0.0',
            true
        );

        assert.deepStrictEqual(
            argumentsList,
            [
                'install',
                '--prefix',
                packageDownloadPath,
                '@contoso/shared-library@>=1.0.0 <2.0.0'
            ]
        );
        assert.strictEqual(commandLine, undefined);
    });

    it('rejects a source-changing package specification when the feature flag is enabled', function () {
        assert.throws(
            () => setNpmArguments(
                {
                    arg: () => assert.fail('npm arguments should not be written'),
                    line: () => assert.fail('npm command line should not be written')
                },
                packageDownloadPath,
                packageName,
                'https://example.invalid/evil.tgz',
                true
            ),
            /Package version must be a registry version, range, or tag/
        );
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
            '1.0.0 --registry https://example.invalid/',
            false
        );

        assert.deepStrictEqual(argumentsList, []);
        assert.strictEqual(
            commandLine,
            `install --prefix ${packageDownloadPath} @contoso/shared-library@1.0.0 --registry https://example.invalid/`
        );
    });
});
