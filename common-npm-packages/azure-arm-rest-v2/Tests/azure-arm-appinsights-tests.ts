import { AzureApplicationInsights } from '../azure-arm-appinsights';
import { getMockEndpoint, nock, mockAzureApplicationInsightsTests } from './mock_utils';
import { AzureEndpoint } from '../azureModels';
import * as querystring from 'querystring';
import tl = require('azure-pipelines-task-lib');
var endpoint = getMockEndpoint();

mockAzureApplicationInsightsTests();

export class AzureApplicationInsightsTests {
    public static async get() {
        try {
            let azureApplicationInsights: AzureApplicationInsights = new AzureApplicationInsights(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_INSIGHTS_NAME");
            let appInsights = await azureApplicationInsights.get();
            console.log(`GET APP INSIGHTS RESOURCE ID MOCKED: ${appInsights.id}`);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureApplicationInsightsTests.get() should have passed but failed.');
        }

        try {
            let azureApplicationInsights: AzureApplicationInsights = new AzureApplicationInsights(endpoint, "MOCK_RESOURCE_GROUP_NAME", "FAIL_MOCK_APP_INSIGHTS_NAME");
            let appInsights = await azureApplicationInsights.get();
            tl.setResult(tl.TaskResult.Failed, 'AzureApplicationInsightsTests.get() should have failed but passed.');
        }
        catch(error) {
            tl.error(error);            
        }
    }

    public static async update() {
        try {
            let azureApplicationInsights: AzureApplicationInsights = new AzureApplicationInsights(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_INSIGHTS_NAME");
            let appInsights = await azureApplicationInsights.get();
            await azureApplicationInsights.update(appInsights);
            console.log(`UPDATE APP INSIGHTS RESOURCE ID MOCKED: ${appInsights.id}`);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureApplicationInsightsTests.update() should have passed but failed.');
        }

        try {
            let azureApplicationInsights: AzureApplicationInsights = new AzureApplicationInsights(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_INSIGHTS_NAME");
            let appInsights = await azureApplicationInsights.get();
            let azureApplicationInsightsFail: AzureApplicationInsights = new AzureApplicationInsights(endpoint, "MOCK_RESOURCE_GROUP_NAME", "FAIL_MOCK_APP_INSIGHTS_NAME");
            appInsights = await azureApplicationInsightsFail.update(appInsights);
            console.log(`UPDATE APP INSIGHTS RESOURCE ID MOCKED: ${appInsights.id}`);
            tl.setResult(tl.TaskResult.Failed, 'AzureApplicationInsightsTests.update() should have failed but passed.');
        }
        catch(error) {
            tl.error(error);
        }
    }
}

AzureApplicationInsightsTests.get();
AzureApplicationInsightsTests.update();