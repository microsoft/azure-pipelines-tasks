import msRestAzure = require('./azure-arm-common');
import webClient = require('./webClient');
import tl = require('vsts-task-lib/task');
import Q = require('q');
var parseString = require('xml2js').parseString;

import { 
    AzureEndpoint,
    AzureAppServiceConfigurationDetails
} from './azureModels';
import { AppServiceManagementClient } from './azure-arm-app-service';
import { Kudu } from './AzureAppServiceKudu';

export class AzureAppService {
    private _appServiceName: string;
    private _resourceGroupName: string;
    private _slotName: string;
    private _appType: string;
    private _appServiceManagementClient: AppServiceManagementClient;
    private _endpoint: AzureEndpoint;
    private _appServiceConfigurationDetails: Promise<AzureAppServiceConfigurationDetails>;
    private _appServicePublishingProfile: Promise<any>;
    private _appServicePublishingCredentials: Promise<AzureAppServiceConfigurationDetails>;

    constructor(endpoint: AzureEndpoint, name: string, resourceGroup?: string, slot?: string, appType?: string) {
        var credentials = new msRestAzure.ApplicationTokenCredentials(endpoint.servicePrincipalClientID, endpoint.tenantID, endpoint.servicePrincipalKey, 
            endpoint.url, endpoint.environmentAuthorityUrl, endpoint.activeDirectoryResourceID, endpoint.environment.toLowerCase() == 'azurestack');

        this._appServiceManagementClient = new AppServiceManagementClient(credentials, endpoint.subscriptionID, {longRunningOperationRetryTimeout: 30});
        this._appServiceName = name;
        this._resourceGroupName = resourceGroup;
        this._slotName = (!slot || slot.toLowerCase() == 'production') ? null : slot;
        this._appType = appType;
    }

    public async start() {
        var defer = Q.defer<any>();

        if(this._slotName) {
            console.log(tl.loc("StartingAppServiceSlot", this._appServiceName, this._slotName));
            this._appServiceManagementClient.appService.startSlot(this._resourceGroupName, this._appServiceName, this._slotName, null, (error, result, request, response) => {
                if(error) {
                    tl.debug(error);
                    defer.reject(tl.loc('FailedToStartAppServiceSlot', this._appServiceName, this._slotName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    console.log(tl.loc('StartedAppServiceSlot', this._appServiceName, this._slotName));
                    defer.resolve(result);
                }
            });
        }
        else {
            console.log(tl.loc("StartingAppService", this._appServiceName));
            this._appServiceManagementClient.appService.start(this._resourceGroupName, this._appServiceName, null, (error, result, request, response) => {
                if(error) {
                    tl.debug(error);
                    defer.reject(tl.loc('FailedToStartAppService', this._appServiceName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    console.log(tl.loc('StartedAppService', this._appServiceName));
                    defer.resolve(result);
                }
            });
        }
        
        return defer.promise;
    }

    public async stop() {
        var defer = Q.defer<any>();

        if(this._slotName) {
            console.log(tl.loc("StoppingAppServiceSlot", this._appServiceName, this._slotName));
            this._appServiceManagementClient.appService.stopSlot(this._resourceGroupName, this._appServiceName, this._slotName, null, (error, result, request, response) => {
                if(error) {
                    tl.debug(error);
                    defer.reject(tl.loc('FailedToStopAppServiceSlot', this._appServiceName, this._slotName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    console.log(tl.loc('StoppedAppServiceSlot', this._appServiceName, this._slotName));
                    defer.resolve(result);
                }
            });
        }
        else {
            console.log(tl.loc("StoppingAppService", this._appServiceName));
            this._appServiceManagementClient.appService.stop(this._resourceGroupName, this._appServiceName, null, (error, result, request, response) => {
                if(error) {
                    tl.debug(error);
                    defer.reject(tl.loc('FailedToStopAppService', this._appServiceName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    console.log(tl.loc('StoppedAppService', this._appServiceName));
                    defer.resolve(result);
                }
            });
        }
        
        return defer.promise;
    }

    public async restart() {
        var defer = Q.defer<any>();

        if(this._slotName) {
            console.log(tl.loc("RestartingAppServiceSlot", this._appServiceName, this._slotName));
            this._appServiceManagementClient.appService.restartSlot(this._resourceGroupName, this._appServiceName, this._slotName, {'synchronous': true}, (error, result, request, response) => {
                if(error) {
                    tl.debug(error);
                    defer.reject(tl.loc('FailedToRestartAppServiceSlot', this._appServiceName, this._slotName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    console.log(tl.loc('RestartedAppServiceSlot', this._appServiceName, this._slotName));
                    defer.resolve(result);
                }
            });
        }
        else {
            console.log(tl.loc("RestartingAppService", this._appServiceName));
            this._appServiceManagementClient.appService.restart(this._resourceGroupName, this._appServiceName, {'synchronous': true}, (error, result, request, response) => {
                if(error) {
                    tl.debug(error);
                    defer.reject(tl.loc('FailedToRestartAppService', this._appServiceName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    console.log(tl.loc('RestartedAppService', this._appServiceName));
                    defer.resolve(result);
                }
            });
        }
        
        return defer.promise;
    }

    public async swap(slotSwapEntity: any) {
        var defer = Q.defer<any>();
        if(this._slotName) {
            console.log(tl.loc("SwappingAppServiceSlotSlots", this._appServiceName, this._slotName, slotSwapEntity.targetSlot));
            this._appServiceManagementClient.appService.swapSlotSlot(this._resourceGroupName, this._appServiceName, slotSwapEntity, this._slotName, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc("FailedToSwapAppServiceSlotSlots", this._appServiceName, this._slotName, slotSwapEntity.targetSlot, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    console.log(tl.loc("SwappedAppServiceSlotSlots", this._appServiceName, this._slotName, slotSwapEntity.targetSlot));
                    defer.resolve(result);
                }
            });
        }
        else {
            console.log(tl.loc("SwappingAppServiceSlotWithProduction", this._appServiceName, this._slotName));
            this._appServiceManagementClient.appService.swapSlotWithProduction(this._resourceGroupName, this._appServiceName, slotSwapEntity, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc("FailedToSwapAppServiceSlotWithProduction", this._appServiceName, slotSwapEntity.targetSlot, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    console.log(tl.loc("SwappedAppServiceSlotWithProduction", this._appServiceName, this._slotName));
                    defer.resolve(result);
                }
            });
        }

        return defer.promise;
    }

    public async get(force?: boolean): Promise<AzureAppServiceConfigurationDetails> {
        if(force || !this._appServiceConfigurationDetails) {
            this._appServiceConfigurationDetails = this._get();
        }

        return this._appServiceConfigurationDetails;
    }

    public async getPublishingProfileWithSecrets(force?: boolean) {
        if(force || !this._appServicePublishingProfile) {
            this._appServicePublishingProfile = this._getPublishingProfileWithSecrets();
        }

        return this._appServicePublishingProfile;
    }

    public async getPublishingCredentials(force?: boolean) {
        if(force || !this._appServicePublishingCredentials) {
            this._appServicePublishingCredentials = this._getPublishingCredentials();
        }

        return this._appServicePublishingCredentials;
    }

    public async getConfiguration() {
        var defer = Q.defer<any>();
        
        if(this._slotName) {
            this._appServiceManagementClient.appService.getConfigurationSlot(this._resourceGroupName, this._appServiceName, this._slotName, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToGetAppServiceConfigurationSlot', this._appServiceName, this._slotName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    tl.debug(`retrieved publishing getConfiguration for App Service '${this._appServiceName}-${this._slotName}'. Result: ${JSON.stringify(result)}`);
                    defer.resolve(result);
                }
            });
        }
        else {
            this._appServiceManagementClient.appService.getConfiguration(this._resourceGroupName, this._appServiceName, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToGetAppServiceConfiguration', this._appServiceName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    tl.debug(`retrieved publishing getConfiguration for App Service '${this._appServiceName}'. Result: ${JSON.stringify(result)}`);
                    defer.resolve(result);
                }
            });
        }

        return defer.promise;
    }

    public async updateConfiguration(siteConfig: any) {
        var defer = Q.defer<any>();
        
        if(this._slotName) {
            this._appServiceManagementClient.appService.updateConfigurationSlot(this._resourceGroupName, this._appServiceName, siteConfig, this._slotName, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToUpdateAppServiceConfigurationSlot', this._appServiceName, this._slotName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    tl.debug(`retrieved publishing getConfiguration for App Service '${this._appServiceName}-${this._slotName}'. Result: ${JSON.stringify(result)}`);
                    defer.resolve(result);
                }
            });
        }
        else {
            this._appServiceManagementClient.appService.updateConfiguration(this._resourceGroupName, this._appServiceName, siteConfig, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToUpdateAppServiceConfiguration', this._appServiceName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    tl.debug(`retrieved publishing getConfiguration for App Service '${this._appServiceName}'. Result: ${JSON.stringify(result)}`);
                    defer.resolve(result);
                }
            });
        }

        return defer.promise;
    }

    public async patchConfiguration(properties: any) {
        tl.debug(`Patch Configuration with data: ${JSON.stringify(properties)}`);
        var appServiceConfiguration = await this.getConfiguration();
        for(var property in properties) {
            appServiceConfiguration.properties[property] = properties[property];
        }

        await this.updateConfiguration(appServiceConfiguration);
    }

    public async getApplicationSettings() {
        var defer = Q.defer<any>();
        
        if(this._slotName) {
            this._appServiceManagementClient.appService.getApplicationSettingsSlot(this._resourceGroupName, this._appServiceName, this._slotName, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToGetAppServiceApplicationSettingsSlot', this._appServiceName, this._slotName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    tl.debug(`retrieved publishing getConfiguration for App Service '${this._appServiceName}-${this._slotName}'. Result: ${JSON.stringify(result)}`);
                    defer.resolve(result);
                }
            });
        }
        else {
            this._appServiceManagementClient.appService.getApplicationSettings(this._resourceGroupName, this._appServiceName, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToGetAppServiceApplicationSettings', this._appServiceName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    tl.debug(`retrieved publishing getConfiguration for App Service '${this._appServiceName}'. Result: ${JSON.stringify(result)}`);
                    defer.resolve(result);
                }
            });
        }

        return defer.promise;
    }

    public async updateApplicationSettings(siteConfig: any) {
        var defer = Q.defer<any>();
        
        if(this._slotName) {
            this._appServiceManagementClient.appService.updateApplicationSettingsSlot(this._resourceGroupName, this._appServiceName, siteConfig, this._slotName, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToUpdateAppServiceApplicationSettingsSlot', this._appServiceName, this._slotName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    tl.debug(`retrieved publishing getConfiguration for App Service '${this._appServiceName}-${this._slotName}'. Result: ${JSON.stringify(result)}`);
                    defer.resolve(result);
                }
            });
        }
        else {
            this._appServiceManagementClient.appService.updateApplicationSettings(this._resourceGroupName, this._appServiceName, siteConfig, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToUpdateAppServiceApplicationSettings', this._appServiceName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    tl.debug(`retrieved publishing getConfiguration for App Service '${this._appServiceName}'. Result: ${JSON.stringify(result)}`);
                    defer.resolve(result);
                }
            });
        }

        return defer.promise;
    }

    public async patchApplicationSettings(properties: any) {
        tl.debug(`Patch Application settings with data: ${JSON.stringify(properties)}`);
        var appServiceConfiguration = await this.getApplicationSettings();
        for(var property in properties) {
            appServiceConfiguration.properties[property] = properties[property];
        }

        await this.updateApplicationSettings(appServiceConfiguration);
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

    public async getSlot() {
        return this._slotName ? this._slotName : "production";
    }

    public async getKuduService() {
        var publishingCredentials = await this.getPublishingCredentials();
        var defer = Q.defer<Kudu>();
        if(publishingCredentials.properties["scmUri"] && publishingCredentials.properties["publishingUserName"] && publishingCredentials.properties["publishingPassword"]) {
            tl.debug(`Retrived Kudu Details`);
            tl.setVariable(`AZURE_APP_SERVICE_KUDU_${this._appServiceName}_${this._slotName}_PASSWORD`, publishingCredentials.properties["publishingPassword"], true);
            defer.resolve(new Kudu(publishingCredentials.properties["scmUri"], publishingCredentials.properties["publishingUserName"], publishingCredentials.properties["publishingPassword"]));
        }
        else {
            defer.reject(tl.loc('KuduSCMDetailsAreEmpty'));
        }

        return defer.promise;
    }

    public async pingApplication(numberOfTimes: number) {
        numberOfTimes = numberOfTimes ? numberOfTimes : 1;
        try {
            var applicationUrl: string = (await this.getWebDeployPublishingProfile()).destinationAppUrl;    
        }
        catch(error) {
            tl.debug(`Unable to get publishing profile for ping application. Error: ${this._appServiceManagementClient.getFormattedError(error)}`);
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
                tl.debug(`Unable to ping App Service. Error: ${this._appServiceManagementClient.getFormattedError(error)}`);
            }
            finally {
                numberOfTimes -= 1;
            }
        }
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

    private async _get() {
        var defer = Q.defer<AzureAppServiceConfigurationDetails>();

        if(this._slotName) {
            this._appServiceManagementClient.appService.getSlot(this._resourceGroupName, this._appServiceName, this._slotName, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToGetAppServiceDetailsSlot', this._appServiceName, this._slotName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    let appDetails = result as AzureAppServiceConfigurationDetails;
                    tl.debug(`Retrieved App Service '${this._appServiceName}-${this._slotName}' details. Location: ${appDetails.location}`);
                    defer.resolve(appDetails);
                }
            });
        }
        else {
            this._appServiceManagementClient.appService.get(this._resourceGroupName, this._appServiceName, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToGetAppServiceDetails', this._appServiceName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    let appDetails = result as AzureAppServiceConfigurationDetails;
                    tl.debug(`Retrieved App Service '${this._appServiceName}' details. Location: ${appDetails.location}`);
                    defer.resolve(appDetails);
                }
            });
        }

        return defer.promise;
    }

    private async _getPublishingProfileWithSecrets() {
        var defer = Q.defer<any>();

        if(this._slotName) {
            this._appServiceManagementClient.appService.listPublishingProfileXmlWithSecretsSlot(this._resourceGroupName, this._appServiceName, this._slotName, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToGetAppServicePublishingProfileSlot', this._appServiceName, this._slotName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    tl.debug(`retrieved publishing profile for App Service '${this._appServiceName}-${this._slotName}'.`);
                    defer.resolve(result);
                }
            });
        }
        else {
            this._appServiceManagementClient.appService.listPublishingProfileXmlWithSecrets(this._resourceGroupName, this._appServiceName, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToGetAppServicePublishingProfile', this._appServiceName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    tl.debug(`retrieved publishing profile for App Service '${this._appServiceName}'.`);
                    defer.resolve(result);
                }
            });
        }

        return defer.promise;
    }

    private async _getPublishingCredentials() {
        var defer = Q.defer<any>();
        
        if(this._slotName) {
            this._appServiceManagementClient.appService.listPublishingCredentialsSlot(this._resourceGroupName, this._appServiceName, this._slotName, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToGetAppServicePublishingCredentialsSlot', this._appServiceName, this._slotName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    tl.debug(`retrieved publishing credentials for App Service '${this._appServiceName}-${this._slotName}'.`);
                    defer.resolve(result);
                }
            });
        }
        else {
            this._appServiceManagementClient.appService.listPublishingCredentials(this._resourceGroupName, this._appServiceName, null, (error, result, request, response) => {
                if(error) {
                    defer.reject(tl.loc('FailedToGetAppServicePublishingCredentials', this._appServiceName, this._appServiceManagementClient.getFormattedError(error)));
                }
                else {
                    tl.debug(`retrieved publishing credentials for App Service '${this._appServiceName}'.`);
                    defer.resolve(result);
                }
            });
        }

        return defer.promise;
    }

}