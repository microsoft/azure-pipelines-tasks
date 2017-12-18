import { ToError, ServiceClient } from './AzureServiceClient';
import msRestAzure = require('./azure-arm-common');
import tl = require('vsts-task-lib/task');
import util = require('util');
import webClient = require('./webClient');
import Model = require('./azureModels');
import Q = require('q');
import { AzureEndpoint } from './azureModels';

export class ApplicationInsightsWebTests {
    private _resourceGroupName: string;
    private _client: ServiceClient;
    private _endpoint: AzureEndpoint;

    constructor(endpoint: AzureEndpoint, resourceGroup?: string) {
        var credentials = new msRestAzure.ApplicationTokenCredentials(endpoint.servicePrincipalClientID, endpoint.tenantID, endpoint.servicePrincipalKey, 
            endpoint.url, endpoint.environmentAuthorityUrl, endpoint.activeDirectoryResourceID, endpoint.environment.toLowerCase() == 'azurestack');

        this._endpoint = endpoint;
        this._client = new ServiceClient(credentials, endpoint.subscriptionID, 30);
        this._resourceGroupName = resourceGroup;
    }

    public async list() {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        
        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/microsoft.insights/webtests`,
        {
            '{resourceGroupName}': this._resourceGroupName
        }, null, '2015-05-01');

        var result = [];

        try {
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            result = result.concat(response.body.value);
            if(response.body.nextLink) {
                var nextResult = await this._client.accumulateResultFromPagedResult(response.body.nextLink);
                if(nextResult.error) {
                    throw ToError(nextResult.error);
                }
                result = result.concat(nextResult.result);
            }

            return result;
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetApplicationInsightsWebTestsForResourceGroup', this._resourceGroupName, this._client.getFormattedError(error)));
        }
    }

    public async create(appInsightsResource: any, applicationUrl: string) {
        
        let httpRequest = new webClient.WebRequest();
        let webTestData = this.configureNewWebTest(appInsightsResource, applicationUrl);
        httpRequest.method = 'PUT';
        
        httpRequest.body = JSON.stringify(webTestData);
        httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/microsoft.insights/webtests/{webTestName}`,
        {
            '{resourceGroupName}': this._resourceGroupName,
            '{webTestName}': webTestData.name
        }, null, '2015-05-01');

        try {
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            return response.body;

        }
        catch(error) {
            throw Error(tl.loc("FailedToCreateWebTests", this._client.getFormattedError(error)));
        }
    }

    public async addWebTest(appInsightsResource: any, applicationUrl: string) {
        var webTests = await this.list();
        for(var webTest of webTests) {
            var isTagPresent: boolean = false;
            var isApplicationUrlPresent: boolean = false;
            for(var tag in webTest.tags) {
                if(tag.toLowerCase().indexOf(appInsightsResource.id.toLowerCase()) != -1) {
                    isTagPresent = true;
                    break;
                }
                
            }

            isApplicationUrlPresent = webTest.properties.Configuration.WebTest.toLowerCase().indexOf(applicationUrl.toLowerCase()) != -1;
            if(isTagPresent && isApplicationUrlPresent) {
                console.log(tl.loc('WebTestAlreadyConfigured', applicationUrl));
                return;
            }
        }

        await this.create(appInsightsResource, applicationUrl);
        
    }

    private configureNewWebTest(appInsightsResource: any, applicationUrl: string) {
        var webTestName = "vsts-web-test-" + Date.now();
        var webTestData =  JSON.parse(JSON.stringify(this._webTestData));
        webTestData.name = webTestName;
        webTestData.properties.Name = webTestName;
        webTestData.properties.SyntheticMonitorId = webTestName;
        webTestData.location = appInsightsResource.location;
        webTestData.tags["hidden-link:" + appInsightsResource.id] = "Resource";
        webTestData.properties.Configuration.WebTest = webTestData.properties.Configuration.WebTest.replace("{WEB_TEST_NAME}", webTestName);
        webTestData.properties.Configuration.WebTest = webTestData.properties.Configuration.WebTest.replace("{APPLICATION_URL}", applicationUrl);

        return webTestData;
    }

    private  _webTestData = {
        "name": "",
        "location": "",
        "tags": {},
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