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

    async function runReleaseType(
        releaseType: string,
        cached: boolean,
        platform: string = 'Linux',
        featureValue?: string,
        failure?: 'download' | 'verify' | 'telemetry'
    ): Promise<ttm.MockTestRunner> {
        const previousTestCase = process.env['DOCKER_INSTALLER_TEST_CASE'];
        process.env['DOCKER_INSTALLER_TEST_CASE'] = JSON.stringify({ releaseType, cached, platform, featureValue, failure });
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

    function assertTelemetry(
        tr: ttm.MockTestRunner,
        platform: string,
        decision: 'accepted' | 'rejected',
        reason: 'none' | 'invalidReleaseType' | 'nightlyUnsupported'
    ): void {
        const events = tr.stdout.split(/\r?\n/)
            .filter(line => line.startsWith('##vso[telemetry.publish '))
            .map(line => {
                assert(line.includes('area=TaskHub;feature=DockerInstallerV0ReleaseTypeValidation;'), line);
                return JSON.parse(line.substring(line.indexOf(']') + 1));
            });
        assert.deepStrictEqual(events, [
            { schemaVersion: 1, validationEnabled: true, platform, event: 'validation', decision, reason }
        ]);
    }

    function assertNoTelemetry(tr: ttm.MockTestRunner): void {
        assert(!tr.stdOutContained('##vso[telemetry.publish '), tr.stdout);
    }

    function assertNoInstallOperations(tr: ttm.MockTestRunner): void {
        for (const operation of ['findLocalTool:', 'downloadTool:', 'cacheFile:', 'chmodSync:', 'prependPath:']) {
            assert(!tr.stdOutContained(operation), tr.stdout);
        }
        assert.strictEqual(tr.invokedToolCount, 0, tr.stdout);
    }

    function assertInstallOperations(tr: ttm.MockTestRunner, releaseType: string, cached: boolean): void {
        assert(tr.succeeded, tr.stdout + tr.stderr);
        assert(tr.stdOutContained(`findLocalTool: docker-${releaseType}, 28.5.2`), tr.stdout);
        assert.strictEqual(tr.stdOutContained('downloadTool:'), !cached, tr.stdout);
        assert.strictEqual(tr.stdOutContained('cacheFile:'), !cached, tr.stdout);
        if (!cached) {
            assert(tr.stdOutContained(`/static/${releaseType}/`), tr.stdout);
            assert(tr.stdOutContained(`cacheFile: docker-${releaseType}, 28.5.2`), tr.stdout);
        }
        assert(tr.stdOutContained('chmodSync:'), tr.stdout);
        assert(tr.stdOutContained('prependPath:'), tr.stdout);
        assert.strictEqual(tr.invokedToolCount, 1, tr.stdout);
    }

    for (const platform of ['Linux', 'Darwin', 'Windows_NT']) {
        for (const releaseType of allowedReleaseTypes) {
            for (const cached of [true, false]) {
                const shouldReject = platform === 'Windows_NT' && releaseType === 'nightly';
                it(`${shouldReject ? 'Rejects' : 'Installs'} ${releaseType} on ${platform} with a cache ${cached ? 'hit' : 'miss'}`, async () => {
                    const tr = await runReleaseType(releaseType, cached, platform, 'true');

                    if (shouldReject) {
                        assert(tr.failed, tr.stdout + tr.stderr);
                        assert(tr.stdOutContained('NightlyNotSupportedOnWindows'), tr.stdout);
                        assertNoInstallOperations(tr);
                        assertTelemetry(tr, platform, 'rejected', 'nightlyUnsupported');
                    } else {
                        assertInstallOperations(tr, releaseType, cached);
                        assertTelemetry(tr, platform, 'accepted', 'none');
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
            const tr = await runReleaseType(releaseType, true, 'Linux', 'true');

            assert(tr.failed, tr.stdout + tr.stderr);
            assert(tr.stdOutContained('InvalidReleaseType'), tr.stdout);
            assert(tr.stdOutContained(allowedReleaseTypes.join(', ')), tr.stdout);
            assertNoInstallOperations(tr);
            assertTelemetry(tr, 'Linux', 'rejected', 'invalidReleaseType');
        });
    }

    for (const featureValue of ['true', 'True', 'TRUE', 'tRuE']) {
        for (const testCase of [
            { releaseType: '../../../repo-tools', platform: 'Linux', error: 'InvalidReleaseType' },
            { releaseType: 'nightly', platform: 'Windows_NT', error: 'NightlyNotSupportedOnWindows' }
        ]) {
            for (const cached of [true, false]) {
                it(`Enables validation for ${testCase.releaseType} with flag ${JSON.stringify(featureValue)} and a cache ${cached ? 'hit' : 'miss'}`, async () => {
                    const tr = await runReleaseType(testCase.releaseType, cached, testCase.platform, featureValue);

                    assert(tr.failed, tr.stdout + tr.stderr);
                    assert(tr.stdOutContained(testCase.error), tr.stdout);
                    assertNoInstallOperations(tr);
                    assertTelemetry(tr, testCase.platform, 'rejected',
                        testCase.error === 'InvalidReleaseType' ? 'invalidReleaseType' : 'nightlyUnsupported');
                });
            }
        }
    }

    for (const featureValue of [undefined, '', 'false', 'False', 'FALSE', 'fAlSe', '0', ' false ', ' true ']) {
        for (const testCase of [
            { releaseType: 'stable', platform: 'Linux' },
            { releaseType: '../../../repo-tools', platform: 'Linux' },
            { releaseType: 'Stable', platform: 'Linux' },
            { releaseType: 'nightly', platform: 'Windows_NT' }
        ]) {
            for (const cached of [true, false]) {
                it(`Keeps legacy ${testCase.releaseType} on ${testCase.platform} with flag ${JSON.stringify(featureValue)} and a cache ${cached ? 'hit' : 'miss'}`, async () => {
                    const tr = await runReleaseType(testCase.releaseType, cached, testCase.platform, featureValue);

                    assertInstallOperations(tr, testCase.releaseType, cached);
                    assertNoTelemetry(tr);
                });
            }
        }
    }

    for (const featureValue of ['true', 'false']) {
        for (const failure of ['download', 'verify'] as const) {
            it(`Preserves ${failure} failure with validation ${featureValue}`, async () => {
                const tr = await runReleaseType('stable', false, 'Linux', featureValue, failure);
                assert(tr.failed, tr.stdout + tr.stderr);
                assert(tr.stdOutContained(failure === 'download' ? 'DockerDownloadFailed' : 'return code: 1'), tr.stdout);
                if (featureValue === 'true') {
                    assertTelemetry(tr, 'Linux', 'accepted', 'none');
                } else {
                    assertNoTelemetry(tr);
                }
            });
        }
    }

    it('Does not attempt telemetry publishing when validation is disabled', async () => {
        const tr = await runReleaseType('stable', true, 'Linux', 'false', 'telemetry');
        assertInstallOperations(tr, 'stable', true);
        assertNoTelemetry(tr);
        assert(!tr.stdOutContained('Unable to publish DockerInstallerV0 release-type validation telemetry.'), tr.stdout);
    });

    it('Does not fail a successful installation when telemetry publishing throws', async () => {
        const tr = await runReleaseType('stable', true, 'Linux', 'true', 'telemetry');
        assertInstallOperations(tr, 'stable', true);
        assert(tr.stdOutContained('Unable to publish DockerInstallerV0 release-type validation telemetry.'), tr.stdout);
        assert(!tr.stdOutContained('##vso[telemetry.publish '), tr.stdout);
    });

    it('Preserves a validation failure when telemetry publishing throws', async () => {
        const tr = await runReleaseType('private-input-not-for-telemetry', true, 'Linux', 'true', 'telemetry');
        assert(tr.failed, tr.stdout + tr.stderr);
        assert(tr.stdOutContained('InvalidReleaseType'), tr.stdout);
        assertNoInstallOperations(tr);
        assert(tr.stdOutContained('Unable to publish DockerInstallerV0 release-type validation telemetry.'), tr.stdout);
        assert(!tr.stdOutContained('##vso[telemetry.publish '), tr.stdout);
    });
});
