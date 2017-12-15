import { AzureApplicationInsights } from '../azure-arm-appinsights';
import { getMockEndpoint, nock } from './mock_utils';
import { AzureEndpoint } from '../azureModels';
import * as querystring from 'querystring';
import tl = require('vsts-task-lib');
var endpoint = getMockEndpoint();

nock('https://www.google.com').post('/').reply(200);
export class AzureApplicationInsightsTests {
    public static async get() {
        var applicationInsights: AzureApplicationInsights = new AzureApplicationInsights(endpoint, 'MOCK_RESOURCE_GROUP', 'MOCK_APP_INSIGHTS_NAME');
        applicationInsights.get().catch((error) => {
            console.log(error);
        })
    }
}

AzureApplicationInsightsTests.get();