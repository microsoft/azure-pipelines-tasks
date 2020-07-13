import tl = require('vsts-task-lib/task');
import { AzureAppService } from 'azure-arm-rest/azure-arm-app-service';
import webClient = require('azure-arm-rest/webClient');
var parseString = require('xml2js').parseString;
import Q = require('q');
import { Kudu } from 'azure-arm-rest/azure-arm-app-service-kudu';
import { AzureAppServiceConfigurationDetails } from 'azure-arm-rest/azureModels';

export class AzureAppServiceUtility {
    private _appService: AzureAppService;
    constructor(appService: AzureAppService) {
        this._appService = appService;
    }

    public async updateScmTypeAndConfigurationDetails() : Promise<void>{
            try {
            var configDetails = await this._appService.getConfiguration();
            var scmType: string = configDetails.properties.scmType;
            if (scmType && scmType.toLowerCase() === "none") {
                configDetails.properties.scmType = 'VSTSRM';
                tl.debug('updating SCM Type to VSTS-RM');
                await this._appService.updateConfiguration(configDetails);
                tl.debug('updated SCM Type to VSTS-RM');
                tl.debug('Updating metadata with latest release details');
                await this._appService.patchMetadata(this._getNewMetadata());
                tl.debug('Updated metadata with latest release details');
                console.log(tl.loc("SuccessfullyUpdatedAzureRMWebAppConfigDetails"));
            }
            else {
                tl.debug(`Skipped updating the SCM value. Value: ${scmType}`);
            }
        }
        catch(error) {
            tl.warning(tl.loc("FailedToUpdateAzureRMWebAppConfigDetails", error));
        }
    }

    public async getWebDeployPublishingProfile(): Promise<any> {
        var publishingProfile = await this._appService.getPublishingProfileWithSecrets();
        var defer = Q.defer<any>();
        parseString(publishingProfile, (error, result) => {
            if(!!error) {
                defer.reject(error);
            }
            var publishProfile = result && result.publishData && result.publishData.publishProfile ? result.publishData.publishProfile : null;
            if(publishProfile) {
                for (var index in publishProfile) {
                    if (publishProfile[index].$ && publishProfile[index].$.publishMethod === "MSDeploy") {
                        defer.resolve(result.publishData.publishProfile[index].$);
                    }
                }
            }
            
            defer.reject(tl.loc('ErrorNoSuchDeployingMethodExists'));
        });

        return defer.promise;
    }

    public async getApplicationURL(virtualApplication ?: string): Promise<string> {
        let webDeployProfile: any =  await this.getWebDeployPublishingProfile();
        return await webDeployProfile.destinationAppUrl + ( virtualApplication ? "/" + virtualApplication : "");
    }

    public async pingApplication(): Promise<void> {
        try {
            var applicationUrl: string = await this.getApplicationURL();

            if(!applicationUrl) {
                tl.debug('Application Url not found.');
                return;
            }
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'GET';
            webRequest.uri = applicationUrl;
            let webRequestOptions:webClient.WebRequestOptions = {retriableErrorCodes: [], retriableStatusCodes: [], retryCount: 1, retryIntervalInSeconds: 5, retryRequestTimedout: true};
            var response = await webClient.sendRequest(webRequest, webRequestOptions);
            tl.debug(`App Service status Code: '${response.statusCode}'. Status Message: '${response.statusMessage}'`);
        }
        catch(error) {
            tl.debug(`Unable to ping App Service. Error: ${error}`);
        }
    }

    public async getKuduService(): Promise<Kudu> {
        var publishingCredentials = await this._appService.getPublishingCredentials();
        if(publishingCredentials.properties["scmUri"]) {
            tl.setVariable(`AZURE_APP_SERVICE_KUDU_${this._appService.getSlot()}_PASSWORD`, publishingCredentials.properties["publishingPassword"], true);
            return new Kudu(publishingCredentials.properties["scmUri"], publishingCredentials.properties["publishingUserName"], publishingCredentials.properties["publishingPassword"]);
        }

        throw Error(tl.loc('KuduSCMDetailsAreEmpty'));
    }

    public async getPhysicalPath(virtualApplication: string): Promise<string> {

        if(!virtualApplication) {
            return '/site/wwwroot';
        }

        virtualApplication = (virtualApplication.startsWith("/")) ? virtualApplication.substr(1) : virtualApplication;

        var physicalToVirtualPathMap = await this._getPhysicalToVirtualPathMap(virtualApplication);

        if(!physicalToVirtualPathMap) {
            throw Error(tl.loc("VirtualApplicationDoesNotExist", virtualApplication));
        }

        tl.debug(`Virtual Application Map: Physical path: '${physicalToVirtualPathMap.physicalPath}'. Virtual path: '${physicalToVirtualPathMap.virtualPath}'.`);
        return physicalToVirtualPathMap.physicalPath;
    }

    public async updateConfigurationSettings(properties: any) : Promise<void> {
        for(var property in properties) {
            if(!!properties[property] && properties[property].value !== undefined) {
                properties[property] = properties[property].value;
            }
        }

        console.log(tl.loc('UpdatingAppServiceConfigurationSettings', JSON.stringify(properties)));
        await this._appService.patchConfiguration({'properties': properties});
        console.log(tl.loc('UpdatedAppServiceConfigurationSettings'));
    }

    public async updateAndMonitorAppSettings(properties: any): Promise<void> {
        for(var property in properties) {
            if(!!properties[property] && properties[property].value !== undefined) {
                properties[property] = properties[property].value;
            }
        }
        
        console.log(tl.loc('UpdatingAppServiceApplicationSettings', JSON.stringify(properties)));
        await this._appService.patchApplicationSettings(properties);
        var kuduService = await this.getKuduService();
        var noOftimesToIterate: number = 12;
        tl.debug('retrieving values from Kudu service to check if new values are updated');
        while(noOftimesToIterate > 0) {
            var kuduServiceAppSettings = await kuduService.getAppSettings();
            var propertiesChanged: boolean = true;
            for(var property in properties) {
                if(kuduServiceAppSettings[property] != properties[property]) {
                    tl.debug('New properties are not updated in Kudu service :(');
                    propertiesChanged = false;
                    break;
                }
            }

            if(propertiesChanged) {
                tl.debug('New properties are updated in Kudu service.');
                console.log(tl.loc('UpdatedAppServiceApplicationSettings'));
                return;
            }

            noOftimesToIterate -= 1;
            await webClient.sleepFor(10);
        }

        tl.debug('Timing out from app settings check');
    }

    public async enableRenameLockedFiles(): Promise<void> {
        try {
            var webAppSettings = await this._appService.getApplicationSettings();
            if(webAppSettings && webAppSettings.properties) {
                if(webAppSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES !== '1') {
                    tl.debug(`Rename locked files value found to be ${webAppSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES}. Updating the value to 1`);
                    await this.updateAndMonitorAppSettings({ 'MSDEPLOY_RENAME_LOCKED_FILES' : '1' });
                    console.log(tl.loc('RenameLockedFilesEnabled'));
                }
                else {
                    tl.debug('Rename locked files is already enabled in App Service');
                }
            }
        }
        catch(error) {
            throw new Error(tl.loc('FailedToEnableRenameLockedFiles', error));
        }
    }

    public async updateStartupCommandAndRuntimeStack(runtimeStack: string, startupCommand?: string): Promise<void> {
        var configDetails = await this._appService.getConfiguration();
        startupCommand = (!!startupCommand) ? startupCommand  : "";
        var linuxFxVersion: string = configDetails.properties.linuxFxVersion;
        var appCommandLine: string = configDetails.properties.appCommandLine;

        if (appCommandLine != startupCommand || runtimeStack != linuxFxVersion) {
            await this.updateConfigurationSettings({linuxFxVersion: runtimeStack, appCommandLine: startupCommand});
        }
        else {
            tl.debug(`Skipped updating the values. linuxFxVersion: ${linuxFxVersion} : appCommandLine: ${appCommandLine}`)
        }
    }

    private async _getPhysicalToVirtualPathMap(virtualApplication: string): Promise<any> {
        // construct URL depending on virtualApplication or root of webapplication 
        var physicalPath = null;
        var virtualPath = "/" + virtualApplication;
        var appConfigSettings = await this._appService.getConfiguration();
        var virtualApplicationMappings = appConfigSettings.properties && appConfigSettings.properties.virtualApplications;

        if(virtualApplicationMappings) {
            for( var mapping of virtualApplicationMappings ) {
                if(mapping.virtualPath.toLowerCase() == virtualPath.toLowerCase()) {
                    physicalPath = mapping.physicalPath;
                    break;
                }
            }
        }
        
        return physicalPath ? {
            'virtualPath': virtualPath,
            'physicalPath': physicalPath
        }: null;
    }

    private _getNewMetadata(): any {
        var collectionUri = tl.getVariable("system.teamfoundationCollectionUri");
        var projectId = tl.getVariable("system.teamprojectId");
        var releaseDefinitionId = tl.getVariable("release.definitionId");

        // Log metadata properties based on whether task is running in build OR release.
    
        let newProperties = {
            VSTSRM_ProjectId: projectId,
            VSTSRM_AccountId: tl.getVariable("system.collectionId")
        }

        if(!!releaseDefinitionId) {
            // Task is running in Release
            let buildDefintionId = tl.getVariable("build.definitionId");
            newProperties["VSTSRM_BuildDefinitionId"] = buildDefintionId;
            newProperties["VSTSRM_ReleaseDefinitionId"] = releaseDefinitionId;
            newProperties["VSTSRM_BuildDefinitionWebAccessUrl"] = collectionUri + projectId + "/_build?_a=simple-process&definitionId=" + buildDefintionId;
            newProperties["VSTSRM_ConfiguredCDEndPoint"] = collectionUri + projectId + "/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?definitionId=" + releaseDefinitionId;
        }
        else {
            // Task is running in Build
            let buildDefintionId = tl.getVariable("system.definitionId");
            newProperties["VSTSRM_BuildDefinitionId"] = buildDefintionId;
            newProperties["VSTSRM_ConfiguredCDEndPoint"] = collectionUri + projectId + "/_build?_a=simple-process&definitionId=" + buildDefintionId;
        }

        return newProperties;
    }

}