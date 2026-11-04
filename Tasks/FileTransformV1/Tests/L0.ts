import * as assert from 'assert';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('FileTransformV1 filename diagnostics', function () {
    this.timeout(20000);
    const featureVariable = 'DISTRIBUTEDTASK_TASKS_ENABLEVSOCOMMANDBLOCKINGRMTASKS';
    for (const feature of [undefined, 'false', 'true']) {
        for (const kind of ['folder', 'archive']) {
            for (const scenario of [undefined, 'missing', 'invalid']) {
                it(`preserves ${kind} transformation and diagnostics, flag=${feature}, scenario=${scenario}`, async () => {
                    const environment = {
                        [featureVariable]: feature,
                        TEST_PACKAGE_KIND: kind,
                        TEST_TRANSFORM_SCENARIO: scenario
                    };
                    const original = Object.keys(environment).map(key => [key, process.env[key]]);
                    try {
                        for (const key of Object.keys(environment)) {
                            if (environment[key] === undefined) {
                                delete process.env[key];
                            } else {
                                process.env[key] = environment[key];
                            }
                        }
                        const runner = new ttm.MockTestRunner(path.join(__dirname, 'FilenameDiagnostics.js'));
                        runner.nodePath = process.execPath;
                        await runner.runAsync();
                        assert(runner.stdOutContained('filename-diagnostics-verified'), runner.stdout + runner.stderr);
                        assert.strictEqual(runner.failed, scenario !== undefined, runner.stdout + runner.stderr);
                        if (scenario) {
                            const error = scenario === 'missing' ? 'NOJSONfilematchedwithspecificpattern' : 'JSONParseError';
                            assert(runner.stdout.includes(error), runner.stdout);
                        }
                        if (scenario !== 'missing') {
                            const folder = kind === 'folder' ? 'raw folder' : 'raw extracted folder';
                            const filename = path.join(__dirname, folder, 'app\n##vso[task.setvariable variable=example]payload.json');
                            const display = feature === 'true' ? filename.replace('##vso[', '##_vso[') : filename;
                            assert(runner.stdout.includes(`Processing file: ${display}\n`), runner.stdout);
                        }
                        const events = runner.stdout.split('\n').filter(line => line.includes('"commandName":"task.setvariable"'));
                        assert.strictEqual(events.length, scenario === 'missing' ? 0 : scenario === 'invalid' ? 1 : 2);
                        for (const event of events) {
                            assert(event.includes('"source":"repository"'));
                            assert(event.includes(`"blocked":${feature === 'true'}`));
                            assert(!event.includes('payload'), 'telemetry must not contain filename payload');
                        }
                    } finally {
                        for (const [key, value] of original) {
                            if (value === undefined) {
                                delete process.env[key];
                            } else {
                                process.env[key] = value;
                            }
                        }
                    }
                });
            }
        }
    }
});

describe('FileTransformV1 Suite', function () {
    this.timeout(20000);
    const compatibilityFeatureVariable = 'DISTRIBUTEDTASK_TASKS_WEBDEPLOYMENTCOMPATIBILITYFIXENABLED';

    if (!tl.osType().match(/^Win/)) {
        return;
    }

    async function runXdtTransformation(featureValue?: string): Promise<ttm.MockTestRunner> {
        const originalFeatureValue = process.env[compatibilityFeatureVariable];
        if (featureValue === undefined) {
            delete process.env[compatibilityFeatureVariable];
        } else {
            process.env[compatibilityFeatureVariable] = featureValue;
        }

        try {
            const runner = new ttm.MockTestRunner(path.join(__dirname, 'L0WindowsXdtTransformation.js'));
            await runner.runAsync();
            return runner;
        } finally {
            if (originalFeatureValue === undefined) {
                delete process.env[compatibilityFeatureVariable];
            } else {
                process.env[compatibilityFeatureVariable] = originalFeatureValue;
            }
        }
    }

    it('Fails XDT transformation when compatibility feature is unset', async () => {
        const runner = await runXdtTransformation();

        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('loc_mock_XdtTransformationFeatureDisabled'),
            'should report that the XDT compatibility feature is disabled');
    });

    it('Fails XDT transformation when compatibility feature is false', async () => {
        const runner = await runXdtTransformation('false');

        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('loc_mock_XdtTransformationFeatureDisabled'),
            'should report that the XDT compatibility feature is disabled');
    });

    it('Applies XDT transformation when compatibility feature is true', async () => {
        const runner = await runXdtTransformation('true');

        assert(runner.succeeded, 'task should have succeeded');
        assert(runner.stdOutContained('loc_mock_XDTTransformationsappliedsuccessfully'),
            'should report that XDT transformations were applied');
    });
});
