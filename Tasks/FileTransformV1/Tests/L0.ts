import * as assert from 'assert';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('FileTransformV1 Suite', function () {
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
