import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
var ltx = require('ltx');
import fs = require('fs');

var AppServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-app-service.js");
var KuduServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-app-service-kudu-tests.js");
var ApplicationInsightsTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-appinsights-tests.js");
var fileEncoding = require("../node_modules/azure-pipelines-tasks-webdeployment-common/fileencoding.js");


describe('AzureRmWebAppDeployment Suite', function() {
    const compatibilityFeatureVariable = 'DISTRIBUTEDTASK_TASKS_WEBDEPLOYMENTCOMPATIBILITYFIXENABLED';

    this.timeout(60000);

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

    before((done) => {
        if(!tl.exist(path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/node_modules'))) {
            tl.cp(path.join( __dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests'), '-rf', true);
        }
        done();
    });

    ApplicationInsightsTests.ApplicationInsightsTests(60000);
    AppServiceTests.AzureAppServiceMockTests(60000);
    KuduServiceTests.KuduServiceTests(60000);

    const windowsIt = tl.osType().match(/^Win/) ? it : it.skip;

    windowsIt('Fails XDT transformation when compatibility feature is unset', async () => {
        const runner = await runXdtTransformation();

        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('loc_mock_XdtTransformationFeatureDisabled'),
            'should report that the XDT compatibility feature is disabled');
    });

    windowsIt('Fails XDT transformation when compatibility feature is false', async () => {
        const runner = await runXdtTransformation('false');

        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('loc_mock_XdtTransformationFeatureDisabled'),
            'should report that the XDT compatibility feature is disabled');
    });

    windowsIt('Applies XDT transformation when compatibility feature is true', async () => {
        const runner = await runXdtTransformation('true');

        assert(runner.succeeded, 'task should have succeeded');
        assert(runner.stdOutContained('loc_mock_XDTTransformationsappliedsuccessfully'),
            'should report that XDT transformations were applied');
    });
});
