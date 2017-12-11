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
import { Kudu } from './azure-arm-app-service-kudu';

var parseString = require('xml2js').parseString;

export class AzureAppService {
    private _endpoint: AzureEndpoint;
    private _resourceGroup: string;
    private _name: string;
    private _slot: string;
    private _appKind: string;
    public _client: ServiceClient;
    private _appServiceConfigurationDetails: AzureAppServiceConfigurationDetails;
    private _appServicePublishingProfile: any;

    constructor(endpoint: AzureEndpoint, resourceGroup: string, name: string, slot?: string, appKind?: string) {
        var credentials = new msRestAzure.ApplicationTokenCredentials(endpoint.servicePrincipalClientID, endpoint.tenantID, endpoint.servicePrincipalKey, 
            endpoint.url, endpoint.environmentAuthorityUrl, endpoint.activeDirectoryResourceID, endpoint.environment.toLowerCase() == 'azurestack');
        this._client = new ServiceClient(credentials, endpoint.subscriptionID, 30);
        this._endpoint = endpoint;
        this._resourceGroup = resourceGroup;
        this._name = name;
        this._slot = (slot && slot.toLowerCase() == 'production') ? null : slot;
        this._appKind = appKind;
    }

    public async start() {
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
            return response.statusCode;
        }
        catch(error) {
            throw Error(tl.loc('FailedToStartAppService', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    public async stop() {
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
            return response.statusCode;
        }
        catch(error) {
            throw Error(tl.loc('FailedToStopAppService', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    public async restart() {
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
            return response.body;
        }
        catch(error) {
            throw Error(tl.loc('FailedToRestartAppService', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    public async swap(slotName: string, preserveVNet?: boolean) {
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
            return response.statusCode;
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

    public async monitorAppState(state: string) {
        state = state.toLowerCase();
        if(["running", "stopped"].indexOf(state) == -1) {
            throw new Error(tl.loc('InvalidMonitorAppState', state));
        }

        while(true) {
            var appDetails = await this.get(true);
            if(appDetails && appDetails.properties && appDetails.properties["state"]) {
                tl.debug(`App Service state: ${appDetails.properties["state"]}`)
                if(appDetails.properties["state"].toLowerCase() == state) {
                    tl.debug(`App Service state '${appDetails.properties["state"]}' matched with expected state '${state}'.`);
                    console.log(tl.loc('AppServiceState', appDetails.properties["state"]));
                    break;
                }
                await webClient.sleepFor(5);
            }
            else {
                tl.debug('Unable to monitor app service details as the state is unknown.');
                break;
            }
        }
    }

    public async getPublishingProfileWithSecrets(force?: boolean) {
        if(force || !this._appServicePublishingProfile) {
            this._appServicePublishingProfile = await this._getPublishingProfileWithSecrets();
        }

        return this._appServicePublishingProfile;
    }

    public async getWebDeployPublishingProfile() {
        var publishingProfile = await this.getPublishingProfileWithSecrets();
        var defer = Q.defer<any>();
        parseString(publishingProfile, (error, result) => {
            for (var index in result.publishData.publishProfile) {
                if (result.publishData.publishProfile[index].$.publishMethod === "MSDeploy") {
                    defer.resolve(result.publishData.publishProfile[index].$);
                }
            }
            defer.reject(tl.loc('ErrorNoSuchDeployingMethodExists'));
        });

        return defer.promise;
    }

    public async pingApplication(numberOfTimes: number) {
        numberOfTimes = numberOfTimes ? numberOfTimes : 1;
        try {
            var applicationUrl: string = (await this.getWebDeployPublishingProfile()).destinationAppUrl;    
        }
        catch(error) {
            tl.debug(`Unable to get publishing profile for ping application. Error: ${this._client.getFormattedError(error)}`);
        }
        
        if(!applicationUrl) {
            tl.debug('Application Url not found.');
            return;
        }

        tl.debug(`Ping App Service for '${numberOfTimes}' time(s).`);
        var webRequest = new webClient.WebRequest();
        webRequest.method = 'GET';
        webRequest.uri = applicationUrl;

        while(numberOfTimes > 0) {
            try {
                tl.debug('pausing for 5 seconds before request');
                await webClient.sleepFor(5);
                var response = await webClient.sendRequest(webRequest);

                tl.debug(`App Service status Code: '${response.statusCode}'. Status Message: '${response.statusMessage}'`);
            }
            catch(error) {
                tl.debug(`Unable to ping App Service. Error: ${this._client.getFormattedError(error)}`);
            }
            finally {
                numberOfTimes -= 1;
            }
        }
    }

    public async getPublishingCredentials() {
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

    public async getApplicationSettings() {
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

    public async updateApplicationSettings(applicationSettings) {
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

    public async patchApplicationSettings(properties) {
        var applicationSettings = await this.getApplicationSettings();
        for(var key in properties) {
            applicationSettings.properties[key] = properties[key];
        }

        await this.updateApplicationSettings(applicationSettings);

    }
    
    public async getConfiguration() {
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

    public async updateConfiguration(applicationSettings) {
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

    public async patchConfiguration(properties) {
        var applicationSettings = await this.getConfiguration();
        for(var key in properties) {
            applicationSettings.properties[key] = properties[key];
        }

        await this.updateConfiguration(applicationSettings);

    }

    public getSlot(): string {
        return this._slot ? this._slot : "production";
    }

    public async getKuduService() {
        var publishingCredentials = await this.getPublishingCredentials();
        if(publishingCredentials.properties["scmUri"]) {
            tl.setVariable(`AZURE_APP_SERVICE_KUDU_${this._name}_${this.getSlot()}_PASSWORD`, publishingCredentials.properties["publishingPassword"], true);
            return new Kudu(publishingCredentials.properties["scmUri"], publishingCredentials.properties["publishingUserName"], publishingCredentials.properties["publishingPassword"]);
        }
        throw Error(tl.loc('KuduSCMDetailsAreEmpty'));
    }
    private async _getPublishingProfileWithSecrets() {
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
}