import tl = require('vsts-task-lib/task');
import { AzureAppService } from 'azure-arm-rest/azure-arm-app-service';
import webClient = require('azure-arm-rest/webClient');
var parseString = require('xml2js').parseString;
import Q = require('q');
import { Kudu } from 'azure-arm-rest/azure-arm-app-service-kudu';
import { AzureAppServiceConfigurationDetails } from 'azure-arm-rest/azureModels';

export class AzureAppServiceUtils {
    private _appService: AzureAppService;
    constructor(appService: AzureAppService) {
        this._appService = appService;
    }

    public async updateScmTypeAndConfigurationDetails() : Promise<void>{
        var configDetails = await this._appService.getConfiguration();
        var scmType: string = configDetails.properties.scmType;
        if (scmType && scmType.toLowerCase() === "none") {
            var updatedConfigDetails = JSON.stringify(
                {
                    "properties": {
                        "scmType": "VSTSRM"
                    }
            });

            configDetails.properties.scmType = 'VSTSRM';
            tl.debug('updating SCM Type to VSTS-RM');
            await this._appService.updateConfiguration(configDetails);
            tl.debug('updated SCM Type to VSTS-RM');
            tl.debug('Updating metadata with latest release details');
            await this._appService.patchMetaData(this._getNewMetaData());
            tl.debug('Updated metadata with latest release details');
        }
    }


    public async monitorApplicationState(state: string): Promise<void> {
        state = state.toLowerCase();
        if(["running", "stopped"].indexOf(state) == -1) {
            throw new Error(tl.loc('InvalidMonitorAppState', state));
        }

        while(true) {
            var appDetails = await this._appService.get(true);
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

    public async getWebDeployPublishingProfile(): Promise<any> {
        var publishingProfile = await this._appService.getPublishingProfileWithSecrets();
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

    public async getApplicationURL(): Promise<string> {
        let webDeployProfile: any =  await this.getWebDeployPublishingProfile();
        return await webDeployProfile.destinationAppUrl;
    }

    public async pingApplication(): Promise<void> {
        try {
            var applicationUrl: string = (await this.getWebDeployPublishingProfile()).destinationAppUrl;

            if(!applicationUrl) {
                tl.debug('Application Url not found.');
                return;
            }
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'GET';
            webRequest.uri = applicationUrl;
            tl.debug('pausing for 5 seconds before request');
            await webClient.sleepFor(5);
            var response = await webClient.sendRequest(webRequest);
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

        var appConfigSettings = await this._appService.getConfiguration();
        var virtualApplicationMappings = appConfigSettings.properties.virtualApplications;
        var phyicalToVirtualPathMap = this._getPhysicalToVirtualPathMap(virtualApplication, virtualApplicationMappings);

        if(!phyicalToVirtualPathMap) {
            throw Error(tl.loc("VirtualApplicationDoesNotExist", virtualApplication));
        }

        tl.debug(`Virtual Application Map: Physical path: '${phyicalToVirtualPathMap.physicalPath}'. Virtual path: '${phyicalToVirtualPathMap.virtualPath}'.`);
        return phyicalToVirtualPathMap.physicalPath;
    }

    private _getPhysicalToVirtualPathMap(virtualApplication: string, virtualApplicationMappings: any) {
        // construct URL depending on virtualApplication or root of webapplication 
        var physicalPath = null;
        var virtualPath = "/" + virtualApplication;
        
        for( var mapping of virtualApplicationMappings ) {
            if(mapping.virtualPath.toLowerCase() == virtualPath.toLowerCase()) {
                physicalPath = mapping.physicalPath;
                break;
            }
        }
        return physicalPath ? {
            'virtualPath': virtualPath,
            'physicalPath': physicalPath
        }: null;
    }

    public async updateAndMonitorAppSettings(properties: any): Promise<void> {
        await this._appService.patchApplicationSettings(properties);
        var kuduService = await this.getKuduService();
        const interator: number = 6;
        tl.debug('retrieving values from Kudu service to check if new values are updated');
        while(interator > 0) {
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
                break;
            }

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
                    tl.debug('Rename locked files is alreay enabled in App Service');
                }
            }
        }
        catch(error) {
            throw new Error(tl.loc('FailedToEnableRenameLockedFiles', error));
        }
    }

    public async updateStartupCommandAndRuntimeStack(runtimeStack: string, startupCommand?: string) {
        var configDetails = await this._appService.getConfiguration();
        var linuxFxVersion: string = configDetails.properties.linuxFxVersion;
        var appCommandLine: string = configDetails.properties.appCommandLine;

        if (!(!!appCommandLine == !!startupCommand && appCommandLine == startupCommand)
        || runtimeStack != linuxFxVersion) {
            configDetails.properties.linuxFxVersion = linuxFxVersion;
            configDetails.properties.appCommandLine = appCommandLine;

            await this._appService.updateConfiguration(configDetails);
        }
    }

    
    private _getNewMetaData() {
        var collectionUri = tl.getVariable("system.teamfoundationCollectionUri");
        var projectId = tl.getVariable("system.teamprojectId");
        var buildDefintionId = tl.getVariable("build.definitionId")
        var releaseDefinitionId = tl.getVariable("release.definitionId");
    
        let newProperties = {
            VSTSRM_BuildDefinitionId: buildDefintionId,
            VSTSRM_ReleaseDefinitionId: releaseDefinitionId,
            VSTSRM_ProjectId: projectId,
            VSTSRM_AccountId: tl.getVariable("system.collectionId"),
            VSTSRM_BuildDefinitionWebAccessUrl: collectionUri + projectId + "/_build?_a=simple-process&definitionId=" + buildDefintionId,
            VSTSRM_ConfiguredCDEndPoint: collectionUri + projectId + "/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?definitionId=" + releaseDefinitionId
        }

        return newProperties;
    }

}