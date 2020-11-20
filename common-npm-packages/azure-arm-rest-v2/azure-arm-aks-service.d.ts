import Model = require("./azureModels");
import webClient = require('./webClient');
import { AzureEndpoint } from './azureModels';
import { ServiceClient } from './AzureServiceClient';
export declare class AzureAksService {
    _client: ServiceClient;
    constructor(endpoint: AzureEndpoint);
    beginRequest(uri: string, parameters: {}): Promise<webClient.WebResponse>;
    getAccessProfile(resourceGroup: string, clusterName: string, useClusterAdmin?: boolean): Promise<Model.AKSClusterAccessProfile>;
}
