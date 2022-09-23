import tl = require('azure-pipelines-task-lib/task');
import webClient = require('azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/webClient');
import {
    AzureEndpoint,
    AzureAppServiceConfigurationDetails
} from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/azureModels';

import {
    ServiceClient,
    ToError
} from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/AzureServiceClient';
import constants = require('azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/constants');
const CorrelationIdInResponse = "x-ms-correlation-request-id";

export class ServiceClient_1 extends ServiceClient{
    public async beginRequest(request: webClient.WebRequest, reqOptions?: webClient.WebRequestOptions): Promise<webClient.WebResponse> {
        var token = await this.getCredentials().getToken();

        request.headers = request.headers || {};
        request.headers["Authorization"] = "Bearer " + token;
        if (this.acceptLanguage) {
            request.headers['accept-language'] = this.acceptLanguage;
        }
        request.headers['Content-Type'] = 'application/json; charset=utf-8';

        var httpResponse = null;

        try
        {
            httpResponse = await webClient.sendRequest(request, reqOptions);
            if (httpResponse.statusCode === 401 && httpResponse.body && httpResponse.body.error && httpResponse.body.error.code === "ExpiredAuthenticationToken") {
                // The access token might have expire. Re-issue the request after refreshing the token.
                token = await this.getCredentials().getToken(true);
                request.headers["Authorization"] = "Bearer " + token;
                httpResponse = await webClient.sendRequest(request, reqOptions);
            }

            if(!!httpResponse.headers[CorrelationIdInResponse]) {
                tl.debug(`Correlation ID from ARM api call response : ${httpResponse.headers[CorrelationIdInResponse]}`);
            }
        } catch(exception) {
            let exceptionString: string = exception.toString();
            if(exceptionString.indexOf("Hostname/IP doesn't match certificates's altnames") != -1
                || exceptionString.indexOf("unable to verify the first certificate") != -1
                || exceptionString.indexOf("unable to get local issuer certificate") != -1) {
                    tl.warning(tl.loc('ASE_SSLIssueRecommendation'));
            } 

            throw exception;
        }

        return httpResponse;
    }
}

export class AzureAppService {
    private _resourceGroup: string;
    private _name: string;
    private _slot: string;
    private _appKind: string;
    private _isConsumptionApp: boolean;
    public _client: ServiceClient_1;
    private _appServiceConfigurationDetails: AzureAppServiceConfigurationDetails;
    private _appServicePublishingProfile: any;
    private _appServiceApplicationSetings: AzureAppServiceConfigurationDetails;
    private _appServiceConfigurationSettings: AzureAppServiceConfigurationDetails;
    private _appServiceConnectionString: AzureAppServiceConfigurationDetails;

    constructor(endpoint: AzureEndpoint, resourceGroup: string, name: string, slot?: string, appKind?: string, isConsumptionApp?: boolean) {
        this._client = new ServiceClient_1(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
        this._resourceGroup = resourceGroup;
        this._name = name;
        this._slot = (slot && slot.toLowerCase() == constants.productionSlot) ? null : slot;
        this._appKind = appKind;
        this._isConsumptionApp = isConsumptionApp;
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

    public async patchApplicationSettings(addProperties: any, deleteProperties?: any, formatJSON?: boolean): Promise<boolean> {
        var applicationSettings = await this.getApplicationSettings();
        var isNewValueUpdated: boolean = false;
        for(var key in addProperties) {
            if(formatJSON) {
                if(JSON.stringify(applicationSettings.properties[key]) != JSON.stringify(addProperties[key])) {
                    tl.debug(`Value of ${key} has been changed to ${JSON.stringify(addProperties[key])}`);
                    isNewValueUpdated = true;
                }
                else {
                    tl.debug(`${key} is already present.`);
                }
            }
            else {
                if(applicationSettings.properties[key] != addProperties[key]) {
                    tl.debug(`Value of ${key} has been changed to ${addProperties[key]}`);
                    isNewValueUpdated = true;
                }
                else {
                    tl.debug(`${key} is already present.`);
                }
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
            applicationSettings.properties[constants.WebsiteEnableSyncUpdateSiteKey] =  this._isConsumptionApp ? 'false' : 'true';
            await this.updateApplicationSettings(applicationSettings);
        }

        return isNewValueUpdated;
    }

    public async patchApplicationSettingsSlot(addProperties: any): Promise<any> {
        var appSettingsSlotSettings = await this.getSlotConfigurationNames();
        let appSettingNames = appSettingsSlotSettings.properties.appSettingNames;
        var isNewValueUpdated: boolean = false;
        for(var key in addProperties) {
            if(!appSettingNames) {
                appSettingsSlotSettings.properties.appSettingNames = [];
                appSettingNames = appSettingsSlotSettings.properties.appSettingNames;
            }
            if(addProperties[key].slotSetting == true) {
                if((appSettingNames.length == 0) || (!appSettingNames.includes(addProperties[key].name))) {
                    appSettingNames.push(addProperties[key].name);
                }
                tl.debug(`Slot setting updated for key : ${addProperties[key].name}`);
                isNewValueUpdated = true;
            }
            else if ((addProperties[key].slotSetting == false || (addProperties[key].slotSetting == null)) && appSettingNames != null ) {                 
                const index = appSettingNames.indexOf(addProperties[key].name, 0);
                if (index > -1) {
                    appSettingNames.splice(index, 1);
                }
                isNewValueUpdated = true;
            }
        }

        if(isNewValueUpdated) {
            await this.updateSlotConfigSettings(appSettingsSlotSettings);
        }
    
    }

    public async syncFunctionTriggers(): Promise<any> {
        try {
            let i = 0;
            let retryCount = 5;
            let retryIntervalInSeconds = 2;
            let timeToWait: number = retryIntervalInSeconds;
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'POST';
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/syncfunctiontriggers`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2016-08-01');
            
            while(true) {
                var response = await this._client.beginRequest(httpRequest);
                if(response.statusCode == 200) {
                    return response.body;
                }
                else if(response.statusCode == 400) {
                    if (++i < retryCount) {
                        await webClient.sleepFor(timeToWait);
                        timeToWait = timeToWait * retryIntervalInSeconds + retryIntervalInSeconds;
                        continue;
                    }
                    else {
                        throw ToError(response);
                    }
                }
                else {
                    throw ToError(response);
                }
            }
        }
        catch(error) {
            throw Error(tl.loc('FailedToSyncTriggers', this._getFormattedName(), this._client.getFormattedError(error)));
        }
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
            }, null, '2018-02-01');
            
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
            }, null, '2018-02-01');
            
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
            }, null, '2018-02-01');
            
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

    public async getConnectionStrings(force?: boolean): Promise<AzureAppServiceConfigurationDetails> {
        if(force || !this._appServiceConnectionString) {
            this._appServiceConnectionString = await this._getConnectionStrings();
        }

        return this._appServiceConnectionString;
    }

    public async getSlotConfigurationNames(force?: boolean): Promise<AzureAppServiceConfigurationDetails> {
        if(force || !this._appServiceConfigurationSettings) {
            this._appServiceConfigurationSettings = await this._getSlotConfigurationNames();
        }

        return this._appServiceConfigurationSettings;
    }

    public async patchConnectionString(addProperties: any): Promise<any> {
        var connectionStringSettings = await this.getConnectionStrings(); 
        var isNewValueUpdated: boolean = false;
        for(var key in addProperties) {
            if(JSON.stringify(connectionStringSettings.properties[key]) != JSON.stringify(addProperties[key])) {
                tl.debug(`Value of ${key} has been changed to ${JSON.stringify(addProperties[key])}`);
                isNewValueUpdated = true;
            }
            else {
                tl.debug(`${key} is already present.`);
            }
            connectionStringSettings.properties[key] = addProperties[key];
        }

        if(isNewValueUpdated) {
            await this.updateConnectionStrings(connectionStringSettings);
        }
    }

    public async updateConnectionStrings(connectionStringSettings: any): Promise<AzureAppServiceConfigurationDetails> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'PUT';
            httpRequest.body = JSON.stringify(connectionStringSettings);
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/config/connectionstrings`,
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
            throw Error(tl.loc('FailedToUpdateAppServiceConnectionStrings', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    public async patchConnectionStringSlot(addProperties: any): Promise<any> {
        var connectionStringSlotSettings = await this.getSlotConfigurationNames();
        let connectionStringNames = connectionStringSlotSettings.properties.connectionStringNames;
        var isNewValueUpdated: boolean = false;
        for(var key in addProperties) {
            if(!connectionStringNames) {
                connectionStringSlotSettings.properties.connectionStringNames = [];
                connectionStringNames = connectionStringSlotSettings.properties.connectionStringNames;
            }
            if(addProperties[key].slotSetting == true) {
                if((connectionStringNames.length == 0) || (!connectionStringNames.includes(key))) {
                    connectionStringNames.push(key);
                }
                tl.debug(`Slot setting updated for key : ${key}`);
                isNewValueUpdated = true;
            }
        }

        if(isNewValueUpdated) {
            await this.updateSlotConfigSettings(connectionStringSlotSettings);
        }
    }

    public async updateSlotConfigSettings(SlotConfigSettings: any): Promise<AzureAppServiceConfigurationDetails> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'PUT';
            httpRequest.body = JSON.stringify(SlotConfigSettings);
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/config/slotConfigNames`,
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
            throw Error(tl.loc('FailedToUpdateAppServiceConfigSlotSettings', this._getFormattedName(), this._client.getFormattedError(error)));
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

    private async _getConnectionStrings(): Promise<AzureAppServiceConfigurationDetails> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'POST';
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/config/connectionstrings/list`,
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
            throw Error(tl.loc('FailedToGetAppServiceConnectionStrings', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    private async _getSlotConfigurationNames(): Promise<AzureAppServiceConfigurationDetails> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'GET';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/config/slotConfigNames`,
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
            throw Error(tl.loc('FailedToGetAppServiceSlotConfigurationNames', this._getFormattedName(), this._client.getFormattedError(error)));
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

    public async getSiteVirtualNetworkConnections(): Promise<any> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'GET';
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/virtualNetworkConnections`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2022-03-01');
            let requestOptions = new webClient.WebRequestOptions();
            requestOptions.retryCount = 1;
            
            var response = await this._client.beginRequest(httpRequest, requestOptions);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            return response.body;
        }
        catch(error) {
            throw Error(`Failed to get Virtual Network Connections. Error: ${this._client.getFormattedError(error)}`);
        }
    }

    public async getSitePrivateEndpointConnections(): Promise<any> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'GET';
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/privateEndpointConnections`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2022-03-01');
            let requestOptions = new webClient.WebRequestOptions();
            requestOptions.retryCount = 1;
            
            var response = await this._client.beginRequest(httpRequest, requestOptions);
            if(response.statusCode != 200) {
                throw ToError(response);
            }

            return response.body;
        }
        catch(error) {
            throw Error(`Failed to get Private Endpoint Connections. Error: ${this._client.getFormattedError(error)}`);
        }
    }

    public async getConnectionStringValidation(connectionDetails): Promise<any> {
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'POST';
            httpRequest.body = JSON.stringify(connectionDetails);
            var slotUrl: string = !!this._slot ? `/slots/${this._slot}` : '';
            httpRequest.uri = this._client.getRequestUri(`//subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Web/sites/{name}/${slotUrl}/extensions/DaaS/api/connectionstringvalidation/validate/`,
            {
                '{resourceGroupName}': this._resourceGroup,
                '{name}': this._name,
            }, null, '2022-03-01');
            let requestOptions = new webClient.WebRequestOptions();
            requestOptions.retryCount = 1;
            
            var response = await this._client.beginRequest(httpRequest, requestOptions);
            if(response.statusCode != 200) {
                throw ToError(response);
            }
            
            return response.body;
        }
        catch(error) {
            throw Error(`Failed to get Connection String Validation. Error: ${this._client.getFormattedError(error)}`);
        }
    }
 }