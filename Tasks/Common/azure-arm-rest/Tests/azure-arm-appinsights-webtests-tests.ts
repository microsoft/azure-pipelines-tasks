import { getMockEndpoint, nock, mockAzureARMAppInsightsWebTests } from './mock_utils';
import { AzureEndpoint } from '../azureModels';
import tl = require('vsts-task-lib');
import { ApplicationInsightsWebTests } from '../azure-arm-appinsights-webtests';

var endpoint = getMockEndpoint();

// Mock all calls for Application Insights web tests
mockAzureARMAppInsightsWebTests();

export class ApplicationInsightsWebTestsTests {
    public static async get() {
        let appInsightsWebTests: ApplicationInsightsWebTests = new ApplicationInsightsWebTests(endpoint, "MOCK_RESOURCE_GROUP_NAME");
        try {
            console.log(`WEB TEST COUNT: ${(await appInsightsWebTests.list()).length}`);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'ApplicationInsightsWebTestsTests.get() should have passed but failed');
        }
    }

    public static async addWebTest() {
        let appInsightsWebTests: ApplicationInsightsWebTests = new ApplicationInsightsWebTests(endpoint, "MOCK_RESOURCE_GROUP_NAME");
        try {
            // await appInsightsWebTests.addWebTest({id: "hidden-link:/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_1".toLowerCase()}, "http://MOCK_APP_1.azurewebsites.net");
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'ApplicationInsightsWebTestsTests.addWebTest() should have passed but failed');
        }
    }

    public static async create() {
        let appInsightsWebTests: ApplicationInsightsWebTests = new ApplicationInsightsWebTests(endpoint, "MOCK_RESOURCE_GROUP_NAME");
        
        try {
            // await appInsightsWebTests.create({
            //    id: "hidden-link:/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_1".toLowerCase()
            // }, "http://MOCK_APP_NEW.azurewebsites.net", "VSTS_MOCK_TEST");
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'ApplicationInsightsWebTestsTests.create() should have passed but failed');
        }

        try {
            // await appInsightsWebTests.create({
            //    id: "hidden-link:/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_FAIL".toLowerCase()
            // }, "http://MOCK_APP_NEW.azurewebsites.net", "VSTS_MOCK_TEST_FAIL");

            tl.setResult(tl.TaskResult.Failed, 'ApplicationInsightsWebTestsTests.create() should have failed but passed');
        }
        catch(error) {

        }
    }
}

ApplicationInsightsWebTestsTests.get();
ApplicationInsightsWebTestsTests.addWebTest();
ApplicationInsightsWebTestsTests.create();