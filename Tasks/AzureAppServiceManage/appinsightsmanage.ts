import tl = require('vsts-task-lib/task');
import Q = require('q');
import path = require('path');

var azureRESTUtils = require('azurerest-common/azurerestutility.js');
var azureUtils = require('azurerest-common/utility.js');
var extensionManage = require('./extensionmanage.js');

var APPLICATION_INSIGHTS_EXTENSION_NAME = "Microsoft.ApplicationInsights.AzureWebSites";

export class AppInsightsManage {

    private endpoint;
    private appInsightsResourceGroupName: string;
    private appInsightsResourceName: string;
    private webAppName: string;
    private resourceGroupName: string;
    private specifySlotFlag: boolean;
    private slotName: string;

    constructor(endpoint, appInsightsResourceGroupName, appInsightsResourceName, webAppName, resourceGroupName, specifySlotFlag, slotName) {
        this.endpoint = endpoint;
        this.appInsightsResourceGroupName = appInsightsResourceGroupName;
        this.appInsightsResourceName = appInsightsResourceName;
        this.webAppName = webAppName;
        this.resourceGroupName = resourceGroupName;
        this.specifySlotFlag = specifySlotFlag;
        this.slotName = slotName;
    }

    public async configureAppInsights() {
        this.resourceGroupName  = (this.specifySlotFlag ? this.resourceGroupName : await azureRESTUtils.getResourceGroupName(this.endpoint, this.webAppName));
        var appServiceDetails = await azureRESTUtils.getAppServiceDetails(this.endpoint, this.resourceGroupName, this.webAppName, this.specifySlotFlag, this.slotName);
        
        if(appServiceDetails && appServiceDetails.kind && appServiceDetails.kind == "app,linux") {
            throw new Error(tl.loc("ApplicationInsightsNotSupportedForLinuxApp", this.webAppName));
        } else {
            await this.installApplicationInsightsExtension();

            var appInsightsResource = await this.getApplicationInsightResource();
            if (appInsightsResource == null) {
                throw new Error(tl.loc('UnableToGetAppInsightsResource', this.appInsightsResourceName));
            }

            appInsightsResource = await this.linkAppInsightsWithAppService(appInsightsResource);
            await this.configureInstrumentationKey(appInsightsResource);
            await this.configureAppServiceAlwaysOnProperty();
            console.log(tl.loc("SuccessfullyConfiguredAppInsights"));
        }
    }

    private async installApplicationInsightsExtension() {
        var publishingProfile = await azureRESTUtils.getAzureRMWebAppPublishProfile(this.endpoint, this.webAppName, this.resourceGroupName, this.specifySlotFlag, this.slotName);
        tl.debug('Retrieved publishing Profile');
        var anyExtensionInstalled = await extensionManage.installExtensions(publishingProfile, [APPLICATION_INSIGHTS_EXTENSION_NAME], []);
        
        if(!anyExtensionInstalled) {
            tl.debug('No new extension installed');
        }
    }

    private async getApplicationInsightResource() {
        var appInsightsResources =  await azureRESTUtils.getApplicationInsightsResources(this.endpoint, this.appInsightsResourceGroupName);
        if(this.appInsightsResourceName != null) {
            for(var appInsightResource of appInsightsResources) {
                if(appInsightResource.name.toLowerCase() == this.appInsightsResourceName.toLowerCase()) {
                    return appInsightResource;
                }
            }
        }

        return null;
    }

    private async linkAppInsightsWithAppService(appInsightsResource) {
        var appInsightsResourceTags =  appInsightsResource.tags;
        var isAppInsightsAlreadyConfigured = false;
        var appInsightsLinkingTag = await this.getAppServiceHiddenLink();

        for(var tagKey in appInsightsResourceTags) {
            if(tagKey == appInsightsLinkingTag) {
                isAppInsightsAlreadyConfigured =  true;
                break;
            }
        }

        if(isAppInsightsAlreadyConfigured) {
            tl.debug("App service '" + this.webAppName + "' is already linked to app insights : " + appInsightsResource.name)
        } else {
            appInsightsResourceTags[appInsightsLinkingTag] = "Resource";
            appInsightsResource = await azureRESTUtils.updateApplicationInsightsResource(this.endpoint, this.appInsightsResourceGroupName, appInsightsResource);
        }

        return appInsightsResource;
    }

    private async getAppServiceHiddenLink() {
        var appServiceDetails = await azureRESTUtils.getAppServiceDetails(this.endpoint, this.resourceGroupName, this.webAppName, this.specifySlotFlag, this.slotName);
        return "hidden-link:" + appServiceDetails.id;
    }

    private async configureInstrumentationKey(appInsightsResource) {
        var appInsightsInstrumenationKey = appInsightsResource.properties.InstrumentationKey;
        var appServiceAppSettings = await azureRESTUtils.getWebAppAppSettings(this.endpoint, this.webAppName, this.resourceGroupName, this.specifySlotFlag, this.slotName);

        if(appInsightsInstrumenationKey && appServiceAppSettings) {
            appServiceAppSettings.properties["APPINSIGHTS_INSTRUMENTATIONKEY"] = appInsightsInstrumenationKey;
            appServiceAppSettings = await azureRESTUtils.updateWebAppAppSettings(this.endpoint, this.webAppName, this.resourceGroupName, this.specifySlotFlag, this.slotName, appServiceAppSettings);
        }
    }

    private async configureAppServiceAlwaysOnProperty() {
        try{
            var appServiceWebSettings = await azureRESTUtils.getAzureRMWebAppConfigDetails(this.endpoint, this.webAppName, this.resourceGroupName, this.specifySlotFlag, this.slotName);
            if(appServiceWebSettings && appServiceWebSettings.properties && appServiceWebSettings.properties.alwaysOn == false) {
                    var configSettings = JSON.stringify({
						"properties": {
							"alwaysOn" : true
						}
					});
                    appServiceWebSettings = await azureRESTUtils.updateAzureRMWebAppConfigDetails(this.endpoint, this.webAppName, this.resourceGroupName, this.specifySlotFlag, this.slotName, configSettings);
            }
        } catch (err) {
            tl.warning(tl.loc("FailedToConfigureAlwaysOnProperty", JSON.stringify(err)));
        }
    }
}


