import msRestAzure = require('./azure-arm-common');
import azureServiceClient = require('./AzureServiceClient');
import tl = require('vsts-task-lib/task');
import Q = require('q');

import { AzureEndpoint } from './azureModels';
import { AppInsightsWebTestsManagementClient } from './azure-arm-appinsights-webtests';

export class ApplicationInsightsWebTests {
    private _resourceGroupName: string;
    private _appInsightsManagementClient: AppInsightsWebTestsManagementClient;
    private _endpoint: AzureEndpoint;

    constructor(endpoint: AzureEndpoint, resourceGroup?: string) {
        var credentials = new msRestAzure.ApplicationTokenCredentials(endpoint.servicePrincipalClientID, endpoint.tenantID, endpoint.servicePrincipalKey, 
            endpoint.url, endpoint.environmentAuthorityUrl, endpoint.activeDirectoryResourceID, endpoint.environment.toLowerCase() == 'azurestack');

        this._endpoint = endpoint;
        this._appInsightsManagementClient = new AppInsightsWebTestsManagementClient(credentials, endpoint.subscriptionID, {longRunningOperationRetryTimeout: 30});
        this._resourceGroupName = resourceGroup;
    }

    public async list() {
        var defer = Q.defer<any>();
        this._appInsightsManagementClient.appInsights.listByResourceGroup(this._resourceGroupName, null, (error, result, request, response) => {
            if(error) {
                defer.reject(tl.loc('FailedToGetApplicationInsightsWebTestsForResourceGroup', 
                    this._resourceGroupName, this._appInsightsManagementClient.getFormattedError(error)));
            }
            else {
                tl.debug(`Retrieved web tests for resource group: ${this._resourceGroupName}. Result: ${JSON.stringify(result)}`);
                defer.resolve(result);
            }
        });

        return defer.promise;
    }

    public async create(appInsightsResource: any, applicationUrl: string) {
        var webTestName = "vsts-web-test-" + Date.now();
        var webTestData =  JSON.parse(JSON.stringify(this.webTestData));
        webTestData.name = webTestName;
        webTestData.properties.Name = webTestName;
        webTestData.properties.SyntheticMonitorId = webTestName;
        webTestData.location = appInsightsResource.location;
        webTestData.tags["hidden-link:" + appInsightsResource.id] = "Resource";
        webTestData.properties.Configuration.WebTest = webTestData.properties.Configuration.WebTest.replace("{WEB_TEST_NAME}", webTestName);
        webTestData.properties.Configuration.WebTest = webTestData.properties.Configuration.WebTest.replace("{APPLICATION_URL}", applicationUrl);
        var defer = Q.defer<any>();
        
        this._appInsightsManagementClient.appInsights.create(this._resourceGroupName, webTestName, webTestData, null, (error, result, request, response) => {
            if(error) {
                defer.reject(tl.loc("FailedToCreateWebTests", this._appInsightsManagementClient.getFormattedError(error)));
            }
            else {
                tl.debug(`Added Web test. Result: ${JSON.stringify(result)}`);
                defer.resolve(result);
            }
        });
        return defer.promise;
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

    private  webTestData = {
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