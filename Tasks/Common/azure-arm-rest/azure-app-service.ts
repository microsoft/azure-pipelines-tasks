import msRestAzure = require('./azure-arm-common');
import webClient = require('./webClient');
import azureServiceClient = require('./AzureServiceClient');
import tl = require('vsts-task-lib/task');
import Q = require('q');
import * as querystring from "querystring";
var parseString = require('xml2js').parseString;

export class AzureAppService {
    private appServiceName: string;
    private resourceGroupName: string;
    private slotName: string;
    private endpoint: any;
    private azureServiceClient: azureServiceClient.ServiceClient; 
    private credentials: msRestAzure.ApplicationTokenCredentials;
    private appDetails: Promise<any>;

    constructor(endpoint: any, name: string, resourceGroup: string, slot: string) {

        this.appServiceName = name;
        this.resourceGroupName = resourceGroup;
        this.credentials = new msRestAzure.ApplicationTokenCredentials(endpoint["servicePrincipalClientID"],
            endpoint["tenantID"], endpoint["servicePrincipalKey"], endpoint["url"], 
            endpoint["envAuthUrl"], endpoint["activeDirectoryResourceId"], endpoint["environment"].toLowerCase() == 'azurestack'
        );
        this.azureServiceClient = new azureServiceClient.ServiceClient(this.credentials, endpoint["subscriptionId"]);
        this.slotName = (slot && slot.toLowerCase() == 'production') ? null : slot;
    }

    public async getResourceGroupName() {
        var dataDeferred = Q.defer<string>();
        if(this.resourceGroupName) {
            console.log("getResourceGroupName in cache");
            dataDeferred.resolve(this.resourceGroupName);
        }
        else {
            console.log('Get RG name from Resource ID')
            this.getResourceID().then((resourceID) => {
                var appServiceResourceID = resourceID[0];
                this.resourceGroupName = appServiceResourceID.id.split('/')[4];
                dataDeferred.resolve(this.resourceGroupName);
            }, (error) => {
                dataDeferred.reject('Unable to retrieve Resource group name. Error: ' + error.toString());
            });
        }
        
        return dataDeferred.promise;
    }

    public async getPublishingProfile() {
        var dataDeferred = Q.defer<any>();
        var resourceGroupName: string = await this.getResourceGroupName();
        var slotUrl: string = this.slotName ? `/slots/${this.slotName}` : '';
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this.azureServiceClient.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.Web/sites/{AppServiceName}/{slotUrl}/publishxml',
            {
                '{ResourceGroupName}': resourceGroupName,
                '{AppServiceName}': this.appServiceName,
                '{slotUrl}': slotUrl
            }, null, '2016-08-01');
        
        this.azureServiceClient.beginRequest(httpRequest).then((response) => {
            if(response.statusCode == 200) {
                var publihingProfile = response.body;
                parseString(publihingProfile, (error, result) => {
                    for (var index in result.publishData.publishProfile) {
                        // Currently, we need Publishing profile - MSDeploy
                        if (result.publishData.publishProfile[index].$.publishMethod === "MSDeploy") {
                            dataDeferred.resolve(result.publishData.publishProfile[index].$);
                        }
                    }
                    dataDeferred.reject(tl.loc('ErrorNoSuchDeployingMethodExists'));
                });
            }
            else {
                dataDeferred.reject('Failed to fetch PP : ' + JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        });

        return dataDeferred.promise;
    }

    public async getAppSettings() {
        var dataDeferred = Q.defer<any>();
        var resourceGroupName: string = await this.getResourceGroupName();
        var slotUrl: string = this.slotName ? `/slots/${this.slotName}` : '';
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this.azureServiceClient.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.Web/sites/{AppServiceName}/{slotUrl}/config/appsettings/list',
            {
                '{ResourceGroupName}': resourceGroupName,
                '{AppServiceName}': this.appServiceName,
                '{slotUrl}': slotUrl
            }, null, '2016-08-01');

        this.azureServiceClient.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            if(response.statusCode == 200) {
                dataDeferred.resolve(response.body);
            }
            else {
                dataDeferred.reject("Failed for get App Details: " + JSON.stringify(response));    
            }
        }, (error) => {
            dataDeferred.reject("Failed for get App Details: " + error.toString())
        });

        return dataDeferred.promise;
    }

    public async getAppDetails(force?: boolean) {
        var dataDeferred = Q.defer<any>();
        if(this.appDetails && !force) {
            console.log("getAppDetails in cache");
            dataDeferred.resolve(this.appDetails);
        }
        else {
            console.log(" getAppDetails not in cache");
            var resourceGroupName: string = await this.getResourceGroupName();
            var slotUrl: string = this.slotName ? `/slots/${this.slotName}` : '';
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'GET';
            httpRequest.uri = this.azureServiceClient.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.Web/sites/{AppServiceName}/{slotUrl}',
                {
                    '{ResourceGroupName}': resourceGroupName,
                    '{AppServiceName}': this.appServiceName,
                    '{slotUrl}': slotUrl
                }, null, '2016-08-01');

            this.azureServiceClient.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
                if(response.statusCode == 200) {
                    this.appDetails = response.body;
                    dataDeferred.resolve(this.appDetails);
                }
                else {

                    dataDeferred.reject("Failed for get App Details: " + JSON.stringify(response));    
                }
            }, (error) => {
                dataDeferred.reject("Failed for get App Details: " + error.toString())
            });
        }

        return dataDeferred.promise;
    }

    // Move to azure-arm-common - Azure Monitor tasks
    private async getResourceID() {
        var dataDeferred = Q.defer<any>();
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this.azureServiceClient.getRequestUri('//subscriptions/{subscriptionId}/resources', null,
            [`$filter=resourceType EQ \'Microsoft.Web/Sites\' AND name EQ \'${this.appServiceName}\'`], '2016-07-01');

        var webAppResourceIdList = [];
        this.azureServiceClient.beginRequest(httpRequest).then((resourceIDRequestResponse) => {
            if(resourceIDRequestResponse.statusCode == 200) {
                webAppResourceIdList = webAppResourceIdList.concat(resourceIDRequestResponse.body.value);
                if(resourceIDRequestResponse.body.nextLink) {
                    this.azureServiceClient.accumulateResultFromPagedResult(resourceIDRequestResponse.body.nextLink).then((value: azureServiceClient.ApiResult) => {
                        if(value.error) {
                            dataDeferred.reject(value.error);
                        }
                        webAppResourceIdList = webAppResourceIdList.concat(value.result);
                        dataDeferred.resolve(webAppResourceIdList);
                    });
                }
                else {
                    dataDeferred.resolve(webAppResourceIdList);
                }
            }
            else {
                dataDeferred.reject(tl.loc('UnabletoretrieveWebAppID', resourceIDRequestResponse.statusCode, resourceIDRequestResponse.statusMessage));
            }
        }, (error) => {
            dataDeferred.reject(error);
        });

        return dataDeferred.promise;
    }


}