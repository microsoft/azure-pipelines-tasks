import msRestAzure = require('./azure-arm-common');
import tl = require('vsts-task-lib/task');
import Q = require('q');

import { AppInsightsManagementClient } from './azure-arm-appinsights'
import { AzureEndpoint } from './azureModels';

export class AzureApplicationInsights {
    private _resourceName: string;
    private _resourceGroupName: string;
    private _endpoint: AzureEndpoint;
    private _appInsightsManagementClient: AppInsightsManagementClient;

    constructor(endpoint: AzureEndpoint, resourceGroupName: string, resourceName: string) {
        var credentials = new msRestAzure.ApplicationTokenCredentials(endpoint.servicePrincipalClientID, endpoint.tenantID, endpoint.servicePrincipalKey, 
            endpoint.url, endpoint.environmentAuthorityUrl, endpoint.activeDirectoryResourceID, endpoint.environment.toLowerCase() == 'azurestack');
        
        this._appInsightsManagementClient = new AppInsightsManagementClient(credentials, endpoint.subscriptionID, {longRunningOperationRetryTimeout: 30});
        this._endpoint = endpoint;
        this._resourceGroupName = resourceGroupName;
        this._resourceName = resourceName;
    }

    public async get() {
        var defer = Q.defer<any>();
        this._appInsightsManagementClient.appInsights.get(this._resourceGroupName, this._resourceName, null, (error, result, request, response) => {
            if(error) {
                defer.reject(tl.loc('FailedToGetApplicationInsightsResource', this._resourceName, this._appInsightsManagementClient.getFormattedError(error)));
            }
            else {
                tl.debug(`Retrieved Application insights '${this._resourceName}' resource. Result: ${JSON.stringify(result)}`);
                defer.resolve(result);
            }
        });

        return defer.promise;
    }

    public async update(insightProperties: any) {
        var defer = Q.defer<any>();
        this._appInsightsManagementClient.appInsights.update(this._resourceGroupName, this._resourceName, insightProperties, null, (error, result, request, response) => {
            if(error) {
                defer.reject(tl.loc('FailedToUpdateApplicationInsightsResource', this._resourceName, this._appInsightsManagementClient.getFormattedError(error)));
            }
            else {
                tl.debug(`Updated Application insights '${this._resourceName}' resource. Result: ${JSON.stringify(result)}`);
                defer.resolve(result);
            }
        });
        return defer.promise;
    }
    
    public getResourceGroupName() {
        return this._resourceGroupName;
    }

    public getEndpoint() {
        return this._endpoint;
    }

}