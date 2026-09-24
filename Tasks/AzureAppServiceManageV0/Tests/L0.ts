import * as assert from 'assert';
import * as path from 'path';

import tl = require('azure-pipelines-task-lib');

import { KuduServiceUtils } from '../operations/KuduServiceUtils';
var AppServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-app-service.js");
var KuduServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-app-service-kudu-tests.js");
var ApplicationInsightsTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-appinsights-tests.js");
var AppInsightsWebTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-appinsights-webtests-tests.js");
var ResourcesTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/L0-azure-arm-resource-tests.js");

describe('Azure App Service Manage Suite', function () {
    this.timeout(60000);

    before((done) => {
        try {
            if (!tl.exist(path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/node_modules'))) {
                tl.cp(path.join(__dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests'), '-rf', true);
            }
        }
        catch (error) {
            tl.debug(error);
        }

        done();
    });

    ApplicationInsightsTests.ApplicationInsightsTests(30000);
    AppServiceTests.AzureAppServiceMockTests(30000);
    KuduServiceTests.KuduServiceTests(30000);
    AppInsightsWebTests.ApplicationInsightsTests(30000);
    ResourcesTests.ResourcesTests(30000);

    async function captureOutput(action: () => Promise<void>): Promise<string> {
        const chunks: string[] = [];
        const originalWrite = process.stdout.write;
        process.stdout.write = ((chunk: any) => {
            chunks.push(String(chunk));
            return true;
        }) as any;

        try {
            await action();
        } finally {
            process.stdout.write = originalWrite;
        }

        return chunks.join('');
    }

    it('filters Kudu WebJob names in start and stop paths', async () => {
        const startCommand = '##vso[task.setvariable variable=BASH_ENV]attacker-startup-command';
        const stopCommand = '##vso[task.setvariable variable=protectedConnectionInjected]unsafe';
        const startOutput = await captureOutput(async () => {
            const kuduServiceMock = {
                getContinuousJobs: async () => [
                    { name: `ordinary-start-job\n${startCommand}`, status: 'Running' }
                ]
            };

            await new KuduServiceUtils(kuduServiceMock as any).startContinuousWebJobs();
        });
        const stopOutput = await captureOutput(async () => {
            const kuduServiceMock = {
                getContinuousJobs: async () => [
                    { name: `ordinary-stop-job\r\n${stopCommand}`, status: 'Stopped' }
                ]
            };

            await new KuduServiceUtils(kuduServiceMock as any).stopContinuousWebJobs();
        });

        assert(startOutput.includes('ordinary-start-job'), startOutput);
        assert(startOutput.includes(startCommand.replace('##vso[', '##_vso[')), startOutput);
        assert(!startOutput.includes(startCommand), startOutput);
        assert(stopOutput.includes('ordinary-stop-job'), stopOutput);
        assert(stopOutput.includes(stopCommand.replace('##vso[', '##_vso[')), stopOutput);
        assert(!stopOutput.includes(stopCommand), stopOutput);
    });
});