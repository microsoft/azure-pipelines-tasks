import msRestAzure = require('./azure-arm-common');
import tl = require('vsts-task-lib/task');
import util = require('util');
import webClient = require('./webClient');
import Q = require('q');
import {
    AzureEndpoint,
    AKSCluster
} from './azureModels';

import {
    ServiceClient,
    ToError
} from './AzureServiceClient';

export class AzureAksService {

    public _client: ServiceClient;
    private _resourceGroup: string;

    constructor(endpoint: AzureEndpoint) {
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
    }

    public async list(): Promise<AKSCluster[]> {
        try {
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'GET';
            webRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/providers/Microsoft.ContainerService/managedClusters`, {}, null,'2017-08-31');

            var response = await this._client.beginRequest(webRequest);
            if(response.statusCode >= 200 && response.statusCode < 300) {
                //success
                if (response.body.value) {
                    let storageAccounts: Model.StorageAccount[] = response.body.value;
                    result = result.concat(storageAccounts);
                }
                
            } else {
                throw ToError(response);
            }
            
            


        }
        catch(error) {
            throw Error(tl.loc('FailedToListClusters', this._client.getFormattedError(error)));
        }

    }

}