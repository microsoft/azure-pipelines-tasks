import tl = require('azure-pipelines-task-lib/task');
import { AzureAppService } from '../azure-arm-rest/azure-arm-app-service';
import webClient = require('azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/webClient');
var parseString = require('xml2js').parseString;
import Q = require('q');
import { Kudu } from '../azure-arm-rest/azure-arm-app-service-kudu';
import { AzureDeployPackageArtifactAlias } from 'azure-pipelines-tasks-azurermdeploycommon-v3/Constants';
import * as os from "os";
var glob = require("glob");

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

    public async updateAndMonitorAppSettings(addProperties?: any, deleteProperties?: any, formatJSON?: boolean): Promise<boolean> {
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

        await this._appService.patchApplicationSettingsSlot(addProperties);
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

    public async getFuntionAppNetworkingCheck(isLinuxApp): Promise<void> {
        let success = true;
        
        try{
            let isFuncPrivate = await this.isFuncWithPrivateEndpoint();
            let isMicrosoftHostedAgent = await this.isMicrosoftHostedAgent();
            
            if (isFuncPrivate == "true" && isMicrosoftHostedAgent == "true"){
                //will NOT be able to reach kudu site if isFuncPrivate and isMicrosoftHostedAgent
                tl.error("Function app has private endpoint(s). But you are not running this pipeline from a self-hosted agent that has access to the Functions App.");
                success = false;
            }
            else if (isFuncPrivate == "true"){               
                //just FYI
                console.log("NOTE: Function app has private endpoint(s). Therefore, make sure that you are running this pipeline from a self-hosted agent that has access to the Functions App.");
            }
  
            let isFuncVNet = await this.isFuncVnetIntegrated();
            if (isFuncVNet == "true"){
                //just FYI
                console.log("NOTE: Function app is VNet integrated.");
            }
          
            //network validation only avaliable for Windows (NOT Linux)
            if (!isLinuxApp) {
                let errormessage = await this.isAzureWebJobsStorageAccessible();
                
                if (errormessage){
                    //AzureWebJobsStorage connection string is NOT accessible from Kudu
                    tl.error(errormessage);
                    success = false;

                    //can be because function app is outside VNet
                    if (isFuncVNet == "false"){
                        tl.error("Function app is NOT VNet integrated.");
                    }
                }   
            }            
        }
        catch(error){
            tl.debug(`Skipping networking check with error: ${error}`);
        }       
        
        if (!success){
            throw Error("Function app networking validation has failed. Please review all error messages for more details.");
        }
    }

    public async isFuncWithPrivateEndpoint(): Promise<string>{
        try{
            let pe: any = await this._appService.getSitePrivateEndpointConnections();
            tl.debug(`Private endpoint check: ${JSON.stringify(pe)}`);
            if (pe && pe.value && pe.value.length && pe.value.length > 0){
                tl.debug("Function app has Private Endpoints.");
                return "true";
            }
            else {            
                tl.debug("Function app has NO Private Endpoints.");
                return "false";
            }
        }
        catch(error){
            tl.debug(`Skipping private endpoint check: ${error}`);
            return null;
        }          
    }

    public async isFuncVnetIntegrated(): Promise<string>{
        try{
            let vnet: any =  await this._appService.getSiteVirtualNetworkConnections();
            tl.debug(`VNET check: ${JSON.stringify(vnet)}`);
            if (vnet && vnet.length && vnet.length > 0){            
                tl.debug("Function app is VNet integrated.");
                return "true";
            }
            else {            
                tl.debug("Function app is NOT VNet integrated.");
                return "false";
            }        
        }
        catch(error){
            tl.debug(`Skipping VNET check: ${error}`);
            return null;
        }        
    }

    public async isMicrosoftHostedAgent(): Promise<string>{
        try{
            let agentos = os.type();
            let dir = "";

            if (agentos.match(/^Window/)){
                tl.debug(`Windows Agent`);
                dir = "C:\\agents\\*\\.setup_info";      
            }
            else if (agentos.match(/^Linux/)){                         
                tl.debug(`Linux Agent`); 
                dir = `${process.env.HOME}/agents/*/.setup_info`;
            }
            else if (agentos.match(/^Darwin/)){
                tl.debug(`MacOS Agent`);
                dir = `${process.env.HOME}/runners/*/.setup_info`;
            }

            var files = glob.sync(dir);          
            if (files && files.length && files.length > 0) {
                tl.debug(`Running on Microsoft-hosted agent.`);
                return "true";
            }
            return "false";
        }
        catch(error){
            tl.debug(`Skipping Agent type check: ${error}`);
            return null;
        }
    }

    public async isAzureWebJobsStorageAccessible(): Promise<string>{        
        let errormessage = "";
        let propertyName = "AzureWebJobsStorage";
        let appSettings = await this._appService.getApplicationSettings();

        if(appSettings && appSettings.properties && appSettings.properties.AzureWebJobsStorage) {
            let connectionDetails = {};
            connectionDetails['ConnectionString'] = appSettings.properties.AzureWebJobsStorage;                
            connectionDetails['Type'] = 'StorageAccount';
            let validation: any = await this._appService.getConnectionStringValidation(connectionDetails);
            tl.debug(`Connection string check: ${JSON.stringify(validation)}`);

            /* Status enums as of Sep 2021
            *  Success,
            *  AuthFailure,
            *  ContentNotFound,
            *  Forbidden,
            *  UnknownResponse,
            *  EndpointNotReachable,
            *  ConnectionFailure,
            *  DnsLookupFailed,
            *  MsiFailure,
            *  EmptyConnectionString,
            *  MalformedConnectionString,
            *  UnknownError
            */
            if (validation && validation.StatusText && validation.StatusText != "Success"){                
                switch (validation.StatusText)
                {
                    case "MalformedConnectionString":
                        errormessage = `Invalid connection string - The "${propertyName}" connection string configured is invalid (e.g. missing some required elements). Please check the value of the app setting "${propertyName}".`;
                        break;
                    case "EmptyConnectionString":
                        errormessage = `Empty connection string - The app setting "${propertyName}" was not found or is set to a blank value`;
                        break;
                    case "DnsLookupFailed":
                        errormessage = `Resource not found - The Storage Account resource specified in the "${propertyName}" connection string was not found.  Please check the value of the app setting "${propertyName}".`;
                        break;
                    case "AuthFailure":
                        errormessage = `Authentication failure - The credentials in the "${propertyName}" connection string are either invalid or expired. Please update the app setting "${propertyName}" with a valid connection string.`;
                        break;
                    case "Forbidden":
                        // Some authentication failures come through as Forbidden so check the exception data
                        if(validation.Exception != undefined && 
                            validation.Exception.RequestInformation != undefined && 
                            JSON.stringify(validation.Exception.RequestInformation).includes("AuthenticationFailed")) {
                                errormessage = `Authentication failure - The credentials in the "${propertyName}" connection string are either invalid or expired. Please update the app setting "${propertyName}" with a valid connection string.`;
                        } else {
                            errormessage = `Access Restrictions - Access to the "${propertyName}" Storage Account resource is restricted. This can be due to firewall rules on the resource. Please check if you have configured firewall rules or a private endpoint and that they correctly allow access from the Function App. Relevant documentation: `
                                + `<a href= "https://docs.microsoft.com/en-us/azure/storage/common/storage-network-security?tabs=azure-portal" target="_blank">Storage account network security</a>`;
                        }
                        break;
                    default:
                        errormessage = `Validation of the "${propertyName}" connection string failed due to an unknown error.`;
                        break;
                }
                // Show the exception message as it contains useful information to fix the issue.  Don't show it unless its accompanied with other explanations.
                errormessage += (errormessage != "" && validation.Exception ? `\r\n\r\nException encountered while connecting: ${validation.Exception.Message}` : undefined);
            } 
        }    
        return errormessage;        
    }
}