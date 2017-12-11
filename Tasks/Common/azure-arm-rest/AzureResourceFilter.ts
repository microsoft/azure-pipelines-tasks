import msRestAzure = require('./azure-arm-common');
import webClient = require('./webClient');
import azureServiceClient = require('./AzureServiceClient');
import tl = require('vsts-task-lib/task');
import Q = require('q');
import { AzureResourceFilterManagementClient } from './azure-arm-resource-filter';
import { AzureEndpoint } from './azureModels';

export class AzureResourceFilterController {
    private _azureResourceFilterManagementClient: AzureResourceFilterManagementClient;
    private _endpoint: AzureEndpoint;

    constructor(endpoint: AzureEndpoint) {
        var credentials = new msRestAzure.ApplicationTokenCredentials(endpoint.servicePrincipalClientID, endpoint.tenantID, endpoint.servicePrincipalKey, 
            endpoint.url, endpoint.environmentAuthorityUrl, endpoint.activeDirectoryResourceID, endpoint.environment.toLowerCase() == 'azurestack');

        this._azureResourceFilterManagementClient = new AzureResourceFilterManagementClient(credentials, endpoint.subscriptionID);
    }

    public async getResources(resourceType: string, resourceName: string) {
        return new Promise<any>((resolve, reject) => {
            tl.debug(`Requesting list of resources for Resource type: '${resourceType}' and Resource name: '${resourceName}'`);
            this._azureResourceFilterManagementClient.azureResourceFilter.getResources(resourceType, resourceName, null, (error, result, request, response) => {
                if(error) {
                    reject(tl.loc('FailedToGetResourceID', resourceType, resourceName, this._azureResourceFilterManagementClient.getFormattedError(error)));
                }
                else {
                    resolve(result);
                }
            });
        });
    }
}