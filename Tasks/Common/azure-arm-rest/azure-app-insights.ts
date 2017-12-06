import msRestAzure = require('./azure-arm-common');
import webClient = require('./webClient');
import azureServiceClient = require('./AzureServiceClient');
import tl = require('vsts-task-lib/task');
import Q = require('q');
import {KuduService} from './azure-app-service-kudu';
import {AzureAppService} from './azure-app-service';
import {
    AzureAppServiceConfigurationDetails,
    AzureAppServicePublishingProfile,
    AzureEndpoint,
} from './azureModels';

export class AzureApplicationInsights extends azureServiceClient.ServiceClient {
    private _resourceGroupName;
    private _resourceName;
    private _endpoint;
    constructor(endpoint: AzureEndpoint, resourceGroupName: string, resourceName: string) {
        var credentials = new msRestAzure.ApplicationTokenCredentials(endpoint.servicePrincipalClientID, endpoint.tenantID, endpoint.servicePrincipalKey, 
            endpoint.url, endpoint.environmentAuthorityUrl, endpoint.activeDirectoryResourceID, endpoint.environment.toLowerCase() == 'azurestack');
        super(credentials, endpoint.subscriptionID);
        this._resourceGroupName = resourceGroupName;
        this._resourceName = resourceName;
    }

    public async addInsightsForAppService(appService: AzureAppService) {
        var appServiceDetails = await appService.getConfigurationDetails("app_details");
        console.log("adding app insights");
        await this._installApplicationInsightExtension(appService);
        console.log("added app insights");
        var appInsightsResource = await this.getApplicationInsightResource();
        appInsightsResource = await this.linkAppInsightsWithAppService(appService, appInsightsResource);
        await this.configureAppServiceAlwaysOnProperty(appService);
    }

    public async updateApplicationInsightResource(appInsightsResource: any) {
        let dataDeferred = Q.defer<any>();
        var webRequest = new webClient.WebRequest();
        webRequest.method = 'PUT';
        webRequest.uri =  this.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/microsoft.insights/components/{ResourceName}', {
            '{ResourceGroupName}': this._resourceGroupName,
            '{ResourceName}': this._resourceName
        }, null , '2015-05-01');
        webRequest.body = JSON.stringify(appInsightsResource);
        this.beginRequest(webRequest).then((response) => {
            if(response.statusCode == 200) {
                dataDeferred.resolve(response.body);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        });
        return dataDeferred.promise;
    }
    
    public async getApplicationInsightResource() {
        let dataDeferred = Q.defer<any>();
        var webRequest = new webClient.WebRequest();
        webRequest.method = 'GET';
        webRequest.uri =  this.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/microsoft.insights/components/{ResourceName}', {
            '{ResourceGroupName}': this._resourceGroupName,
            '{ResourceName}': this._resourceName
        }, null , '2015-05-01');

        this.beginRequest(webRequest).then((response) => {
            if(response.statusCode == 200) {
                dataDeferred.resolve(response.body);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        });
        return dataDeferred.promise;
    }

    private async _installApplicationInsightExtension(appService: AzureAppService) {
        const APPLICATION_INSIGHTS_EXTENSION_NAME = "Microsoft.ApplicationInsights.AzureWebSites";
        var appServiceDetails = await appService.getConfigurationDetails("app_details");
        if(appServiceDetails && appServiceDetails.kind && appServiceDetails.kind!= "app,linux") {
            var kuduService = await appService.getKuduService();
            await kuduService.installExtension(APPLICATION_INSIGHTS_EXTENSION_NAME);
        }
    }

    private async linkAppInsightsWithAppService(appService: AzureAppService, appInsightsResource: any) {
        var appInsightsResourceTags =  appInsightsResource.tags;
        var isAppInsightsAlreadyConfigured = false;
        var appDetails = await appService.getAppDetails();
        var appInsightsLinkingTag = "hidden-link:" + appDetails.id;
        for(var tagKey in appInsightsResourceTags) {
            if(tagKey == appInsightsLinkingTag) {
                isAppInsightsAlreadyConfigured =  true;
                break;
            }
        }

        var appName = appService.getName();
        if(isAppInsightsAlreadyConfigured) {
            tl.debug("App service '" + appName + "' is already linked to app insights : " + appInsightsResource.name)
        } else {
            appInsightsResourceTags[appInsightsLinkingTag] = "Resource";
            appInsightsResource = await this.updateApplicationInsightResource(appInsightsResource);
            tl.debug("Successfully linked app service '" + appName + "' to app insights : " + appInsightsResource.name);
        }

        return appInsightsResource;
    }

    private async configureInstrumentationKey(appService: AzureAppService, appInsightsResource: any) {
        var appInsightsInstrumenationKey = appInsightsResource.properties.InstrumentationKey;
        var appServiceAppSettings = await appService.getConfigurationDetails("appsettings");
        await appService.patchConfigurationDetails("appsettings", {
            "APPINSIGHTS_INSTRUMENTATIONKEY": appInsightsInstrumenationKey
        });
    }

    private async configureAppServiceAlwaysOnProperty(appService: AzureAppService) {
        try {
            await appService.patchConfigurationDetails("web", {
                "alwaysOn": true
            });

            tl.debug("Always on property is successfully configured for app service : " + appService.getName());
        } catch (err) {
            tl.warning(tl.loc("FailedToConfigureAlwaysOnProperty", JSON.stringify(err)));
        }
    }
}