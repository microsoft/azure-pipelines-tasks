import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DockerInstallerV0 Suite', function () {
    this.timeout(60000);

    const task: { inputs: { name: string; options?: { [value: string]: string } }[] } =
        JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'task.json'), 'utf8'));
    const allowedReleaseTypes = Object.keys(task.inputs.find(input => input.name === 'releaseType').options);

    it('Runs successfully with default inputs', async () => {
        const tp = path.join(__dirname, 'L0InstallDockerDefault.js');
        if (fs.existsSync(tp)) {
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();

            assert(tr.succeeded, 'task should have succeeded');
        }
    });

    it('Fails when docker download fails', async () => {
        const tp = path.join(__dirname, 'L0InstallDockerFail.js');
        if (fs.existsSync(tp)) {
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();

            assert(tr.failed, 'task should have failed');
        }
    });

    async function runReleaseType(releaseType: string, cached: boolean, platform: string = 'Linux'): Promise<ttm.MockTestRunner> {
        const previousTestCase = process.env['DOCKER_INSTALLER_TEST_CASE'];
        process.env['DOCKER_INSTALLER_TEST_CASE'] = JSON.stringify({ releaseType, cached, platform });
        try {
            const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ReleaseType.js'));
            await tr.runAsync();
            return tr;
        } finally {
            if (previousTestCase === undefined) {
                delete process.env['DOCKER_INSTALLER_TEST_CASE'];
            } else {
                process.env['DOCKER_INSTALLER_TEST_CASE'] = previousTestCase;
            }
        }
    }

    function assertNoInstallOperations(tr: ttm.MockTestRunner): void {
        for (const operation of ['findLocalTool:', 'downloadTool:', 'cacheFile:', 'chmodSync:', 'prependPath:']) {
            assert(!tr.stdOutContained(operation), tr.stdout);
        }
        assert.strictEqual(tr.invokedToolCount, 0, tr.stdout);
    }

    for (const platform of ['Linux', 'Darwin', 'Windows_NT']) {
        for (const releaseType of allowedReleaseTypes) {
            for (const cached of [true, false]) {
                const shouldReject = platform === 'Windows_NT' && releaseType === 'nightly';
                it(`${shouldReject ? 'Rejects' : 'Installs'} ${releaseType} on ${platform} with a cache ${cached ? 'hit' : 'miss'}`, async () => {
                    const tr = await runReleaseType(releaseType, cached, platform);

                    if (shouldReject) {
                        assert(tr.failed, tr.stdout + tr.stderr);
                        assert(tr.stdOutContained('NightlyNotSupportedOnWindows'), tr.stdout);
                        assertNoInstallOperations(tr);
                    } else {
                        assert(tr.succeeded, tr.stdout + tr.stderr);
                        assert(tr.stdOutContained(`findLocalTool: docker-${releaseType}, 28.5.2`), tr.stdout);
                        assert.strictEqual(tr.stdOutContained('downloadTool:'), !cached, tr.stdout);
                        assert.strictEqual(tr.stdOutContained('cacheFile:'), !cached, tr.stdout);
                        assert(tr.stdOutContained('chmodSync:'), tr.stdout);
                        assert(tr.stdOutContained('prependPath:'), tr.stdout);
                        assert.strictEqual(tr.invokedToolCount, 1, tr.stdout);
                    }
                });
            }
        }
    }

    for (const releaseType of [
        '../../../repo-tools',
        '..\\..\\..\\repo-tools',
        '../..\\../repo-tools',
        'stable/../../repo-tools',
        'stable\\..\\..\\repo-tools',
        'stable/extra',
        '/repo-tools',
        'C:\\repo-tools',
        'unknown',
        'Stable',
        'stable ',
        '$(releaseType)'
    ]) {
        it(`Rejects invalid release type ${JSON.stringify(releaseType)} before using the cache`, async () => {
            const tr = await runReleaseType(releaseType, true);

            assert(tr.failed, tr.stdout + tr.stderr);
            assert(tr.stdOutContained('InvalidReleaseType'), tr.stdout);
            assert(tr.stdOutContained(allowedReleaseTypes.join(', ')), tr.stdout);
            assertNoInstallOperations(tr);
        });
    }
});
