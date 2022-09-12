import msRestAzure = require('./azure-arm-common');
import tl = require('azure-pipelines-task-lib/task');
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
import { Kudu } from './azure-arm-app-service-kudu';
import constants = require('./constants');
var parseString = require('xml2js').parseString;

export class AzureAppService {
    private _resourceGroup: string;
    private _name: string;
    private _slot: string;
    private _appKind: string;
    public _client: ServiceClient;
    private _appServiceConfigurationDetails: AzureAppServiceConfigurationDetails;
    private _appServicePublishingProfile: any;
    private _appServiceApplicationSetings: AzureAppServiceConfigurationDetails;

    constructor(endpoint: AzureEndpoint, resourceGroup: string, name: string, slot?: string, appKind?: string) {
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
        this._resourceGroup = resourceGroup;
        this._name = name;
        this._slot = (slot && slot.toLowerCase() == constants.productionSlot) ? null : slot;
        this._appKind = appKind;
    }

    public async start(): Promise<void> {
        try {
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'POST';
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            webRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/start`, {
                '{ResourceGroupName}': this._resourceGroup,
                '{name}': this._name
            }, null, '2016-08-01');

            console.log(tl.loc('StartingAppService', this._getFormattedName()));
            var response = await this._client.beginRequest(webRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            console.log(tl.loc('StartedAppService', this._getFormattedName()));
        }
        catch(error) {
            throw Error(tl.loc('FailedToStartAppService', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    public async stop(): Promise<void> {
        try {
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'POST';
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            webRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/stop`, {
                '{ResourceGroupName}': this._resourceGroup,
                '{name}': this._name
            }, null, '2016-08-01');

            console.log(tl.loc('StoppingAppService', this._getFormattedName()));
            var response = await this._client.beginRequest(webRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            console.log(tl.loc('StoppedAppService', this._getFormattedName()));
        }
        catch(error) {
            throw Error(tl.loc('FailedToStopAppService', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    public async restart(): Promise<void> {
        try {
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'POST';
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            webRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/restart`, {
                '{ResourceGroupName}': this._resourceGroup,
                '{name}': this._name
            }, null, '2016-08-01');

            console.log(tl.loc('RestartingAppService', this._getFormattedName()));
            var response = await this._client.beginRequest(webRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            console.log(tl.loc('RestartedAppService', this._getFormattedName()));
        }
        catch(error) {
            throw Error(tl.loc('FailedToRestartAppService', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    public async swap(slotName: string, preserveVNet?: boolean): Promise<void> {
        try {
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'POST';
            webRequest.body = JSON.stringify({
                targetSlot: slotName,
                preserveVnet: preserveVNet
            });

            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            webRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/slotsswap`, {
            '{ResourceGroupName}': this._resourceGroup,
            '{name}': this._name,
            '{slotUrl}': slotUrl
            }, null, '2016-08-01');

            console.log(tl.loc('SwappingAppServiceSlotSlots', this._name, this.getSlot(), slotName));
            var response = await this._client.beginRequest(webRequest);
            if(response.statusCode == 202) {
                response= await this._client.getLongRunningOperationResult(response);
            }
            
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            console.log(tl.loc('SwappedAppServiceSlotSlots', this._name, this.getSlot(), slotName));
        }
        catch(error) {
            throw Error(tl.loc('FailedToSwapAppServiceSlotSlots', this._name, this.getSlot(), slotName, this._client.getFormattedError(error)));
        }
    }

    public async get(force?: boolean): Promise<AzureAppServiceConfigurationDetails> {
        if(force || !this._appServiceConfigurationDetails) {
            this._appServiceConfigurationDetails = await this._get();
        }
        
        return this._appServiceConfigurationDetails;
    }

    public async getPublishingProfileWithSecrets(force?: boolean): Promise<any>{
        if(force || !this._appServicePublishingProfile) {
            this._appServicePublishingProfile = await this._getPublishingProfileWithSecrets();
        }

        return this._appServicePublishingProfile;
    }

    public async getPublishingCredentials(): Promise<any> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'POST';
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/config/publishingcredentials/list`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2016-08-01');
            
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            return response.body;
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetAppServicePublishingCredentials', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    public async getApplicationSettings(force?: boolean): Promise<AzureAppServiceConfigurationDetails> {
        if(force || !this._appServiceApplicationSetings) {
            this._appServiceApplicationSetings = await this._getApplicationSettings();
        }

        return this._appServiceApplicationSetings;
    }

    public async updateApplicationSettings(applicationSettings): Promise<AzureAppServiceConfigurationDetails> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'PUT';
            httpRequest.body = JSON.stringify(applicationSettings);
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/config/appsettings`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2016-08-01');
            
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            return response.body;
        }
        catch(error) {
            throw Error(tl.loc('FailedToUpdateAppServiceApplicationSettings', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    public async patchApplicationSettings(addProperties: any, deleteProperties?: any): Promise<boolean> {
        var applicationSettings = await this.getApplicationSettings();
        var isNewValueUpdated: boolean = false;
        for(var key in addProperties) {
            if(applicationSettings.properties[key] != addProperties[key]) {
                tl.debug(`old value : ${applicationSettings.properties[key]}. new value: ${addProperties[key]}`);
                isNewValueUpdated = true;
            }

            applicationSettings.properties[key] = addProperties[key];
        }
        for(var key in deleteProperties) {
            if(key in applicationSettings.properties) {
                delete applicationSettings.properties[key];
                tl.debug(`Removing app setting : ${key}`);
                isNewValueUpdated = true;
            }
        }

        if(isNewValueUpdated) {
            await this.updateApplicationSettings(applicationSettings);
        }

        return isNewValueUpdated;
    }
    
    public async getConfiguration(): Promise<AzureAppServiceConfigurationDetails> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'GET';
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/config/web`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2016-08-01');
            
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            return response.body;
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetAppServiceConfiguration', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    public async updateConfiguration(applicationSettings): Promise<AzureAppServiceConfigurationDetails> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'PUT';
            httpRequest.body = JSON.stringify(applicationSettings);
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/config/web`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2016-08-01');
            
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            return response.body;
        }
        catch(error) {
            throw Error(tl.loc('FailedToUpdateAppServiceConfiguration', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    public async patchConfiguration(properties: any): Promise<any> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'PATCH';
            httpRequest.body = JSON.stringify(properties);
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/config/web`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2016-08-01');
            
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            return response.body;
        }
        catch(error) {
            throw Error(tl.loc('FailedToPatchAppServiceConfiguration', this._getFormattedName(), this._client.getFormattedError(error)));
        }

    }

    public async getMetadata(): Promise<AzureAppServiceConfigurationDetails> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'POST';
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/config/metadata/list`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2016-08-01');
            
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            return response.body;
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetAppServiceMetadata', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    public async updateMetadata(applicationSettings): Promise<AzureAppServiceConfigurationDetails> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'PUT';
            httpRequest.body = JSON.stringify(applicationSettings);
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/config/metadata`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2016-08-01');
            
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            return response.body;
        }
        catch(error) {
            throw Error(tl.loc('FailedToUpdateAppServiceMetadata', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }
    
    public async patchMetadata(properties): Promise<void> {
        var applicationSettings = await this.getMetadata();
        for(var key in properties) {
            applicationSettings.properties[key] = properties[key];
        }

        await this.updateMetadata(applicationSettings);
    }
    
    public getSlot(): string {
        return this._slot ? this._slot : "production";
    }
    
    private async _getPublishingProfileWithSecrets(): Promise<any> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'POST';
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/publishxml`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2016-08-01');
            
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            var publishingProfile = response.body;
            return publishingProfile;
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetAppServicePublishingProfile', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    private async _getApplicationSettings(): Promise<AzureAppServiceConfigurationDetails> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'POST';
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/config/appsettings/list`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2016-08-01');
            
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            return response.body;
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetAppServiceApplicationSettings', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    private async _get(): Promise<AzureAppServiceConfigurationDetails> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'GET';
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2016-08-01');
            
            var response = await this._client.beginRequest(httpRequest);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            var appDetails = response.body;
            return appDetails as AzureAppServiceConfigurationDetails;
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetAppServiceDetails', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    private _getFormattedName(): string {
        return this._slot ? `${this._name}-${this._slot}` : this._name;
    }

    public getName(): string {
        return this._name;
    }
 }