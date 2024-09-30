import msRestAzure = require('./azure-arm-common');
import tl = require('azure-pipelines-task-lib/task');
import Model = require("./azureModels");
import util = require('util');
import webClient = require('./webClient');
import Q = require('q');
import path = require('path');
import {
    AzureEndpoint,
    AKSCluster
} from './azureModels';

import {
    ServiceClient
} from './AzureServiceClient';

import {
    ToError
} from './AzureServiceClientBase';

tl.setResourcePath(path.join(__dirname, 'module.json'), true);

export class AzureAksService {

    public _client: ServiceClient;

    constructor(endpoint: AzureEndpoint) {
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
    }

    public beginRequest(uri: string,  parameters: {}, apiVersion: string, method: string) : Promise<webClient.WebResponse> {
         var webRequest = new webClient.WebRequest();
         webRequest.method = method || 'GET';
         webRequest.uri = this._client.getRequestUri(uri, parameters, null, apiVersion);
        return this._client.beginRequestExpBackoff(webRequest, 3).then((response)=>{
            if(response.statusCode >= 200 && response.statusCode < 300) {
                return response;
            } else {
                throw ToError(response);
            }
        });
    } 

    public getAccessProfile(resourceGroup : string , clusterName : string, useClusterAdmin?: boolean): Promise<Model.AKSClusterAccessProfile> {
        var accessProfileName = !!useClusterAdmin ? 'clusterAdmin' : 'clusterUser';
        return this.beginRequest(`//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.ContainerService/managedClusters/{ClusterName}/accessProfiles/{AccessProfileName}`,
        {
            '{ResourceGroupName}': resourceGroup,
            '{ClusterName}': clusterName,
            '{AccessProfileName}': accessProfileName
        }, '2017-08-31', "GET").then((response) => {
            return  response.body;
        }, (reason) => {
            throw Error(tl.loc('CantDownloadAccessProfile',clusterName,  this._client.getFormattedError(reason)));
        });
    }

    public getClusterCredentials(resourceGroup : string , clusterName : string, useClusterAdmin?: boolean): Promise<Model.AKSCredentialResults> {
        var credentialAction = !!useClusterAdmin ? 'listClusterAdminCredential' : 'listClusterUserCredential';
        return this.beginRequest(`//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.ContainerService/managedClusters/{ClusterName}/{CredentialAction}`,
        {
            '{ResourceGroupName}': resourceGroup,
            '{ClusterName}': clusterName,
            '{CredentialAction}': credentialAction
        }, '2024-05-01', "POST").then((response) => {
            return  response.body;
        }, (reason) => {
            throw Error(tl.loc('CantDownloadClusterCredentials',clusterName,  this._client.getFormattedError(reason)));
        });
    }

    public getClusterCredential(resourceGroup : string , clusterName : string, useClusterAdmin?: boolean, credentialName?: string): Promise<Model.AKSCredentialResult> {
        var credentialName = !!credentialName ? credentialName : !!useClusterAdmin ? 'clusterAdmin' : 'clusterUser';
        var clusterCredentials = this.getClusterCredentials(resourceGroup, clusterName, useClusterAdmin)
        return clusterCredentials.then((credentials) => {
           var credential = credentials.kubeconfigs.find(credential => credential.name == credentialName)
            if (credential === undefined) {
                throw Error(tl.loc('CantDownloadClusterCredentials', clusterName, `${credentialName} not found in the list of cluster credentials.`));
            }
            return credential;
        })
    }
}