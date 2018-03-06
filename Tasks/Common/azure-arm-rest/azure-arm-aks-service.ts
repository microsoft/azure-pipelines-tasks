import msRestAzure = require('./azure-arm-common');
import tl = require('vsts-task-lib/task');
import Model = require("./azureModels");
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

    constructor(endpoint: AzureEndpoint) {
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
    }

    public list(): Promise<Model.AKSCluster[]> {
        try {
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'GET';
            webRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/providers/Microsoft.ContainerService/managedClusters`, {}, null,'2017-08-31');

            var result = [];
            return this._client.beginRequest(webRequest).then((response)=>{
                if(response.statusCode >= 200 && response.statusCode < 300) {
                    //success
                    if (response.body.value) {
                        let storageAccounts: Model.AKSCluster[] = response.body.value;
                        result = result.concat(storageAccounts);
                    }
                    return result;
                    
                } else {
                    throw ToError(response);
                }
            }, (response) => {
                throw ToError(response);
            });
        }
        catch(error) {
            throw Error(tl.loc('FailedToListClusters', this._client.getFormattedError(error)));
        }
    }

    public getKubeConfigFile(resourceGroup : string , clusterName : string ): Promise<Model.AKSClusterAccessProfile> {
        try {
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'GET';
            webRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.ContainerService/managedClusters/{ClusterName}/accessProfiles/clusterUser`, {
                '{ResourceGroupName}': resourceGroup,
                '{ClusterName}': clusterName
            }, null,'2017-08-31');
            
            var result : Model.AKSClusterAccessProfile;
            return this._client.beginRequest(webRequest).then((response)=>{
                if(response.statusCode >= 200 && response.statusCode < 300) {
                    //success
                    if (response.body) {
                        return response.body;
                    }

                    throw ToError(response);
                    
                } else {
                    throw ToError(response);
                }
            }, (response) => {
                throw ToError(response);
            });

        }
        catch(error) {
            throw Error(tl.loc('FailedToListClusters', this._client.getFormattedError(error)));
        }
    }
}