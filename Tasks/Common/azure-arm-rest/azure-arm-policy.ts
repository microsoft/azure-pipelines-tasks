import msRestAzure = require('./azure-arm-common');
import tl = require('vsts-task-lib/task');
import util = require('util');
import webClient = require('./webClient');
import Q = require('q');
import {
    AzureEndpoint,
    AzureAppServiceConfigurationDetails
} from './azureModels';

import {
    ServiceClient,
    ToError
} from './AzureServiceClient';
import constants = require('./constants');

export class AzurePolicy
{
    public _client: ServiceClient;
    public _managementGroupId: string;
    
    constructor(endpoint: AzureEndpoint)
    {
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
        this._managementGroupId = endpoint.managementGroupId;
    }

    public async create(policyDefinitionName:string, policyDefinition: string): Promise<void>
    {
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'PUT';
            webRequest.body = policyDefinition;

            webRequest.uri = this._client.getRequestUri(`/providers/Microsoft.Management/managementGroups/{managementGroupId}/providers/Microsoft.Authorization/policyDefinitions/{policyDefinitionName}`, {
                '{policyDefinitionName}': policyDefinitionName,
                '{managementGroupId}': this._managementGroupId
            }, null, '2016-12-01');
          
            var response = await this._client.beginRequest(webRequest);
            if(response.statusCode != 200 && response.statusCode != 201) {
                throw ToError(response);
            }

            return response.body;
    }

    public async assign(policyDefinitionName:string, policyData: string): Promise<void>
    {
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'PUT';
            webRequest.body = policyData;

            webRequest.uri = this._client.getRequestUri('/providers/Microsoft.Management/managementGroups/{managementGroupId}/providers/Microsoft.Authorization/policyAssignments/{policyDefinitionName}', {
                '{policyDefinitionName}': policyDefinitionName,
                '{managementGroupId}': this._managementGroupId
            }, null, '2018-03-01');

            var response = await this._client.beginRequest(webRequest);
            if(response.statusCode != 200 && response.statusCode != 201) {
                throw ToError(response);
            }

            return response.body;
    }
}