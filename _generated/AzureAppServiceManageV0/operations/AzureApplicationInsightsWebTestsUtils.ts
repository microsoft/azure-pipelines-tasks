import tl = require('azure-pipelines-task-lib/task');
import { AzureEndpoint, WebTest } from 'azure-pipelines-tasks-azure-arm-rest/azureModels';
import { ApplicationInsightsWebTests } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-appinsights-webtests';

export class AzureApplicationInsightsWebTestsUtils {

    constructor(applicationInsightsWebTests: ApplicationInsightsWebTests) {
        this._applicationInsightsWebTests = applicationInsightsWebTests;
    }

    public async addWebTest(appInsightsResource: any, applicationUrl: string, testName?: string): Promise<void> {
        let webTests = await this._applicationInsightsWebTests.list();

        for(let webTest of webTests) {
            let isTagPresent: boolean = false;
            let isApplicationUrlPresent: boolean = false;
            for(let tag in webTest.tags) {
                if(tag.toLowerCase().indexOf(appInsightsResource.id.toLowerCase()) != -1) {
                    isTagPresent = true;
                    break;
                }
            }

            isApplicationUrlPresent = webTest.properties['Configuration'].WebTest.toLowerCase().indexOf(applicationUrl.toLowerCase()) != -1;
            if(isTagPresent && isApplicationUrlPresent) {
                console.log(tl.loc('WebTestAlreadyConfigured', applicationUrl));
                return;
            }
        }

        await this.create(appInsightsResource, applicationUrl, testName);
    }

    public async create(appInsightsResource: any, applicationUrl: string, testName?: string): Promise<void> {
        let webTestData: WebTest = this.configureNewWebTest(appInsightsResource, applicationUrl, testName);
        await this._applicationInsightsWebTests.create(webTestData);
    }

    public configureNewWebTest(appInsightsResource: any, applicationUrl: string, testName?: string): WebTest {
        let webTestName = testName ? testName: "vsts-web-test-" + Date.now();
        let webTestData =  JSON.parse(JSON.stringify(this._webTestData));
        webTestData.name = webTestName;
        webTestData.properties.Name = webTestName;
        webTestData.properties.SyntheticMonitorId = webTestName;
        webTestData.location = appInsightsResource.location;
        webTestData.tags["hidden-link:" + appInsightsResource.id] = "Resource";
        webTestData.properties.Configuration.WebTest = webTestData.properties.Configuration.WebTest.replace("{WEB_TEST_NAME}", webTestName);
        webTestData.properties.Configuration.WebTest = webTestData.properties.Configuration.WebTest.replace("{APPLICATION_URL}", applicationUrl);

        return webTestData;
    }

    private _applicationInsightsWebTests: ApplicationInsightsWebTests;
    private  _webTestData: WebTest = {
        "name": "",
        "location": "",
        "tags": {},
        "type": "microsoft.insights/webtests",
        "properties": {
            "SyntheticMonitorId": "",
            "Name": "",
            "Description": "",
            "Enabled": true,
            "Frequency": 300,
            "Timeout": 120,
            "Kind": "ping",
            "RetryEnabled": true,
            "Locations": [
                {
                    "Id": "us-tx-sn1-azr"
                },
                {
                    "Id": "us-il-ch1-azr"
                },
                {
                    "Id": "us-ca-sjc-azr"
                },
                {
                    "Id": "us-va-ash-azr"
                },
                {
                    "Id": "us-fl-mia-edge"
                }
            ],
            "Configuration": {
                "WebTest": "<WebTest Name=\"{WEB_TEST_NAME}\" Enabled=\"True\" CssProjectStructure=\"\"  CssIteration=\"\"  Timeout=\"120\"  WorkItemIds=\"\"  xmlns=\"http://microsoft.com/schemas/VisualStudio/TeamTest/2010\" Description=\"\" CredentialUserName=\"\" CredentialPassword=\"\" PreAuthenticate=\"True\" Proxy=\"default\" StopOnError=\"False\" RecordedResultFile=\"\" ResultsLocale=\"\"> <Items> <Request Method=\"GET\"  Version=\"1.1\"  Url=\"{APPLICATION_URL}\"  ThinkTime=\"0\" Timeout=\"120\" ParseDependentRequests=\"True\" FollowRedirects=\"True\"         RecordResult=\"True\"         Cache=\"False\" ResponseTimeGoal=\"0\" Encoding=\"utf-8\"  ExpectedHttpStatusCode=\"200\" ExpectedResponseUrl=\"\"  ReportingName=\"\" IgnoreHttpStatusCode=\"False\" /></Items></WebTest>"
            }
        }
    }


}