import tl = require('azure-pipelines-task-lib/task');
var glob = require("glob");
import * as os from "os";
import { AzureAppService } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service';
import { AzureDeployPackageArtifactAlias } from 'azure-pipelines-tasks-azure-arm-rest/constants';
import webClient = require('azure-pipelines-tasks-azure-arm-rest/webClient');
import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service-kudu';
import { AzureAppServiceUtility as AzureAppServiceUtilityCommon } from 'azure-pipelines-tasks-azure-arm-rest/azureAppServiceUtility';


export class AzureAppServiceUtilityExt {
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

    public async getKuduService(): Promise<Kudu> {
        
        const utility = new AzureAppServiceUtilityCommon(this._appService);
        return await utility.getKuduService();

    }

    // Adding checking for property to be updated in Kudu first and then in App Service
    public async updateAndMonitorAppSettings(addProperties: any, deleteProperties?: any): Promise<boolean> {
        for(var property in addProperties) {
            if(!!addProperties[property] && addProperties[property].value !== undefined) {
                addProperties[property] = addProperties[property].value;
            }
        }
        
        console.log(tl.loc('UpdatingAppServiceApplicationSettings', JSON.stringify(addProperties)));
        var isNewValueUpdated: boolean = await this._appService.patchApplicationSettings(addProperties, deleteProperties);
        
        if(!!isNewValueUpdated) {
            console.log(tl.loc('UpdatedAppServiceApplicationSettings'));
        }
        else {
            console.log(tl.loc('AppServiceApplicationSettingsAlreadyPresent'));
            return isNewValueUpdated;
        }

        var kuduService = await this.getKuduService();
        var noOftimesToIterate: number = 12;
        tl.debug('retrieving values from Kudu service to check if new values are updated');
        while(noOftimesToIterate > 0) {
            var kuduServiceAppSettings = await kuduService.getAppSettings();
            var propertiesChanged: boolean = true;
            for(var property in addProperties) {
                if(kuduServiceAppSettings[property] != addProperties[property]) {
                    tl.debug('New properties are not updated in Kudu service :(');
                    propertiesChanged = false;
                    break;
                }
            }
            for(var property in deleteProperties) {
                if(kuduServiceAppSettings[property]) {
                    tl.debug('Deleted properties are not reflected in Kudu service :(');
                    propertiesChanged = false;
                    break;
                }
            }

            if(propertiesChanged) {
                tl.debug('New properties are updated in Kudu service.');
                console.log(tl.loc('UpdatedAppServiceApplicationSettings'));
                return isNewValueUpdated;
            }

            noOftimesToIterate -= 1;
            await webClient.sleepFor(5);
        }

        tl.debug('Timing out from app settings check');
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
                tl.error("Function app has private endpoint(s). But you are not running this pipeline from a self-hosted agent that has access to the Functions App. Relevant documentation: "
                + "https://learn.microsoft.com/en-us/azure/devops/pipelines/agents/agents?view=azure-devops&tabs=browser#install");
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
                        console.log("NOTE: Function app is NOT VNet integrated.");
                    }
                }
            }
        }
        catch(error){
            tl.debug(`Skipping networking check with error: ${error}`);
        }

        if (!success){
            throw Error("Networking validation for the Function app and Storage account has failed. Please review all error messages.");
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

            if(connectionDetails['ConnectionString'].includes('@Microsoft.KeyVault')){
                console.log("NOTE: Skipping AzureWebJobsStorage connection string validation since Key Vault reference is used.");
            }
            else{
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
                                    + `https://docs.microsoft.com/en-us/azure/storage/common/storage-network-security?tabs=azure-portal`;
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
        }
        return errormessage;
    }
}