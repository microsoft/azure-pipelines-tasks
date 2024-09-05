import tl = require('azure-pipelines-task-lib/task');
import { AzureAppService } from '../azure-arm-rest/azure-arm-app-service';
import webClient = require('../azure-arm-rest/webClient');
var parseString = require('xml2js').parseString;
import Q = require('q');
import { Kudu } from '../azure-arm-rest/azure-arm-app-service-kudu';
import { AzureDeployPackageArtifactAlias } from '../Constants';

export class AzureAppServiceUtility {
    private _appService: AzureAppService;
    constructor(appService: AzureAppService) {
        this._appService = appService;
    }

    public async updateScmTypeAndConfigurationDetails() : Promise<void>{
        try {
            var configDetails = await this._appService.getConfiguration();
            var scmType: string = configDetails.properties.scmType;
            let shouldUpdateMetadata = false;
            if (scmType && scmType.toLowerCase() === "none") {
                configDetails.properties.scmType = 'VSTSRM';
                tl.debug('updating SCM Type to VSTS-RM');
                await this._appService.updateConfiguration(configDetails);
                tl.debug('updated SCM Type to VSTS-RM');
                shouldUpdateMetadata = true;
            }
            else if (scmType && scmType.toLowerCase() == "vstsrm") {
                tl.debug("SCM Type is VSTSRM");
                shouldUpdateMetadata = true;
            }
            else {
                tl.debug(`Skipped updating the SCM value. Value: ${scmType}`);
            }

            if (shouldUpdateMetadata) {
                tl.debug('Updating metadata with latest pipeline details');
                let newMetadataProperties = this._getNewMetadata();
                let siteMetadata = await this._appService.getMetadata();
                let skipUpdate = true;
                for (let property in newMetadataProperties) {
                    if (siteMetadata.properties[property] !== newMetadataProperties[property]) {
                        siteMetadata.properties[property] = newMetadataProperties[property];
                        skipUpdate = false;
                    }
                }

                if (!skipUpdate) {
                    await this._appService.patchMetadata(siteMetadata.properties);
                    tl.debug('Updated metadata with latest pipeline details');
                    console.log(tl.loc("SuccessfullyUpdatedAzureRMWebAppConfigDetails"));
                }
                else {
                    tl.debug("No changes in metadata properties, skipping update.");
                }
            }
        }
        catch (error) {
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

    public async getApplicationURL(virtualApplication?: string): Promise<string> {
        let webDeployProfile: any =  await this.getWebDeployPublishingProfile();
        return await webDeployProfile.destinationAppUrl + ( virtualApplication ? "/" + virtualApplication : "" );
    }

    public async pingApplication(): Promise<void> {
        try {
            var applicationUrl: string = await this.getApplicationURL();

            if(!applicationUrl) {
                tl.debug("Application Url not found.");
                return;
            }
            await AzureAppServiceUtility.pingApplication(applicationUrl);
        } catch(error) {
            tl.debug("Unable to ping App Service. Error: ${error}");
        }
    }

    public static async pingApplication(applicationUrl: string) {
        if(!applicationUrl) {
            tl.debug('Application Url empty.');
            return;
        }
        try {
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'GET';
            webRequest.uri = applicationUrl;
            let webRequestOptions: webClient.WebRequestOptions = {retriableErrorCodes: [], retriableStatusCodes: [], retryCount: 1, retryIntervalInSeconds: 5, retryRequestTimedout: true};
            var response = await webClient.sendRequest(webRequest, webRequestOptions);
            tl.debug(`App Service status Code: '${response.statusCode}'. Status Message: '${response.statusMessage}'`);
        }
        catch(error) {
            tl.debug(`Unable to ping App Service. Error: ${error}`);
        }
    }

    public async getKuduService(): Promise<Kudu> {     

        const publishingCredentials = await this._appService.getPublishingCredentials();
        const scmUri = publishingCredentials.properties["scmUri"];

        if (!scmUri) {
            throw Error(tl.loc('KuduSCMDetailsAreEmpty'));
        }

        const authHeader = await this.getKuduAuthHeader(publishingCredentials);
        return new Kudu(publishingCredentials.properties["scmUri"], authHeader);        
    }

    private async getKuduAuthHeader(publishingCredentials: any): Promise<string> {
        const scmPolicyCheck = await this.isSitePublishingCredentialsEnabled(); 

        let token = "";
        let method = "";

        const password = publishingCredentials.properties["publishingPassword"];
        const userName = publishingCredentials.properties["publishingUserName"];

        if(scmPolicyCheck === false) {
            token = await this._appService._client.getCredentials().getToken();
            method = "Bearer";

            
            // Though bearer AuthN is used, lets try to set publish profile password for mask hints to maintain compat with old behavior for MSDEPLOY. 
            // This needs to be cleaned up once MSDEPLOY suppport is reomve. Safe handle the exception setting up mask hint as we dont want to fail here.
            try {      
                tl.setVariable(`AZURE_APP_MSDEPLOY_${this._appService.getSlot()}_PASSWORD`, password, true);
            }
            catch (error) {
                // safe handle the exception setting up mask hint
                tl.debug(`Setting mask hint for publish profile password failed with error: ${error}`);
            }

        } else {
            tl.setVariable(`AZURE_APP_SERVICE_KUDU_${this._appService.getSlot()}_PASSWORD`, password, true);
            const buffer = new Buffer(userName + ':' + password);
            token = buffer.toString('base64');
            method = "Basic";
        }

        const authMethodtelemetry = {
            authMethod: method
        };
        tl.debug(`Using ${method} authentication method for Kudu service.`);
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureAppServiceDeployment]" + JSON.stringify(authMethodtelemetry));

        return method + " " + token;
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

    public async updateConfigurationSettings(properties: any, formatJSON?: boolean) : Promise<void> {
        if(formatJSON) {
            var configurationSettingsProperties = properties[0];
            console.log(tl.loc('UpdatingAppServiceConfigurationSettings', JSON.stringify(configurationSettingsProperties)));
            await this._appService.patchConfiguration({'properties': configurationSettingsProperties});
        }
        else
        {
            for(var property in properties) {
                if(!!properties[property] && properties[property].value !== undefined) {
                    properties[property] = properties[property].value;
                }
            }
    
            console.log(tl.loc('UpdatingAppServiceConfigurationSettings', JSON.stringify(properties)));
            await this._appService.patchConfiguration({'properties': properties});    
        }
        console.log(tl.loc('UpdatedAppServiceConfigurationSettings'));
    }

    public async updateAndMonitorAppSettings(addProperties?: any, deleteProperties?: any, formatJSON?: boolean, perSlot: boolean = true): Promise<boolean> {
        if(formatJSON) {
            var appSettingsProperties = {};
            for(var property in addProperties) {
                appSettingsProperties[addProperties[property].name] = addProperties[property].value;
            }
        
            if(!!addProperties) {
                console.log(tl.loc('UpdatingAppServiceApplicationSettings', JSON.stringify(appSettingsProperties)));
            }

            if(!!deleteProperties) {
                console.log(tl.loc('DeletingAppServiceApplicationSettings', JSON.stringify(Object.keys(deleteProperties))));
            }
            
            var isNewValueUpdated: boolean = await this._appService.patchApplicationSettings(appSettingsProperties, deleteProperties, true);
        }
        else {
            for(var property in addProperties) {
                if(!!addProperties[property] && addProperties[property].value !== undefined) {
                    addProperties[property] = addProperties[property].value;
                }
            }
            
            if(!!addProperties) {
                console.log(tl.loc('UpdatingAppServiceApplicationSettings', JSON.stringify(addProperties)));
            }

            if(!!deleteProperties) {
                console.log(tl.loc('DeletingAppServiceApplicationSettings', JSON.stringify(Object.keys(deleteProperties))));
            }

            var isNewValueUpdated: boolean = await this._appService.patchApplicationSettings(addProperties, deleteProperties);
        }     

        if(!!isNewValueUpdated) {
            console.log(tl.loc('UpdatedAppServiceApplicationSettings'));
        }
        else {
            console.log(tl.loc('AppServiceApplicationSettingsAlreadyPresent'));
        }

        if (perSlot) {
            await this._appService.patchApplicationSettingsSlot(addProperties);
        } 
        return isNewValueUpdated;
    }

    public async updateConnectionStrings(addProperties: any): Promise<boolean>  {
        var connectionStringProperties = {};
        for(var property in addProperties) {
            if (!addProperties[property].type) {
                addProperties[property].type = "Custom";
            }
            if (!addProperties[property].slotSetting) {
                addProperties[property].slotSetting = false;
            }
            connectionStringProperties[addProperties[property].name] = addProperties[property];
            delete connectionStringProperties[addProperties[property].name].name;
        }

        console.log(tl.loc('UpdatingAppServiceConnectionStrings', JSON.stringify(connectionStringProperties)));
        var isNewValueUpdated: boolean = await this._appService.patchConnectionString(connectionStringProperties);
        await this._appService.patchConnectionStringSlot(connectionStringProperties);

        if(!!isNewValueUpdated) {
            console.log(tl.loc('UpdatedAppServiceConnectionStrings'));
        }
        else {
            console.log(tl.loc('AppServiceConnectionStringsAlreadyPresent'));
        }

        return isNewValueUpdated;
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
        var appCommandLine: string = configDetails.properties.appCommandLine;
        startupCommand = (!!startupCommand) ? startupCommand : appCommandLine;
        var linuxFxVersion: string = configDetails.properties.linuxFxVersion;
        runtimeStack = (!!runtimeStack) ? runtimeStack : linuxFxVersion;

        if (startupCommand != appCommandLine || runtimeStack != linuxFxVersion) {
            await this.updateConfigurationSettings({linuxFxVersion: runtimeStack, appCommandLine: startupCommand});
        }
        else {
            tl.debug(`Skipped updating the values. linuxFxVersion: ${linuxFxVersion} : appCommandLine: ${appCommandLine}`)
        }
    }

    public async isSitePublishingCredentialsEnabled(): Promise<boolean>{
        try{
            let scmAuthPolicy: any = await this._appService.getSitePublishingCredentialPolicies();
            tl.debug(`Site Publishing Policy check: ${JSON.stringify(scmAuthPolicy)}`);
            if(scmAuthPolicy && scmAuthPolicy.properties.allow) {
                tl.debug("Function App does allow SCM access");
                return true;
            }
            else {
                tl.debug("Function App does not allow SCM Access");
                return false;
            }
        }
        catch(error){
            tl.debug(`Call to get SCM Policy check failed: ${error}`);
            return false;
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
            var artifactAlias = tl.getVariable(AzureDeployPackageArtifactAlias);
            tl.debug("Artifact Source Alias is: "+ artifactAlias);
            
            let buildDefinitionUrl = "";
            let buildDefintionId = "";

            if (artifactAlias) {
                let artifactType = tl.getVariable(`release.artifacts.${artifactAlias}.type`);
                // Get build definition info only when artifact type is build.
                if (artifactType && artifactType.toLowerCase() == "build") {

                    buildDefintionId = tl.getVariable("build.definitionId");
                    let buildProjectId = tl.getVariable("build.projectId") || projectId;
                    let artifactBuildDefinitionId = tl.getVariable("release.artifacts." + artifactAlias + ".definitionId");
                    let artifactBuildProjectId = tl.getVariable("release.artifacts." + artifactAlias + ".projectId");

                    if (artifactBuildDefinitionId && artifactBuildProjectId) {
                        buildDefintionId = artifactBuildDefinitionId;
                        buildProjectId = artifactBuildProjectId;
                    }

                    buildDefinitionUrl = collectionUri + buildProjectId + "/_build?_a=simple-process&definitionId=" + buildDefintionId;
                }
            }
            
            newProperties["VSTSRM_BuildDefinitionId"] = buildDefintionId;
            newProperties["VSTSRM_ReleaseDefinitionId"] = releaseDefinitionId;
            newProperties["VSTSRM_BuildDefinitionWebAccessUrl"] = buildDefinitionUrl;
            newProperties["VSTSRM_ConfiguredCDEndPoint"] = collectionUri + projectId + "/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?definitionId=" + releaseDefinitionId;
        }
        else {
            // Task is running in Build
            let buildDefintionId = tl.getVariable("system.definitionId");
            newProperties["VSTSRM_BuildDefinitionId"] = buildDefintionId;
            let buildDefinitionUrl = collectionUri + projectId + "/_build?_a=simple-process&definitionId=" + buildDefintionId;
            newProperties["VSTSRM_BuildDefinitionWebAccessUrl"] = buildDefinitionUrl
            newProperties["VSTSRM_ConfiguredCDEndPoint"] = buildDefinitionUrl;
        }

        return newProperties;
    }

    public async isFunctionAppOnCentauri(): Promise<boolean>{
        try{
            let details: any =  await this._appService.get();
            if (details.properties["managedEnvironmentId"]){
                tl.debug("Function Container app is on Centauri.");
                return true;
            }
            else{                
                return false;    
            }
        }
        catch(error){
            tl.debug(`Skipping Centauri check: ${error}`);
            return false;
        }        
    }

}