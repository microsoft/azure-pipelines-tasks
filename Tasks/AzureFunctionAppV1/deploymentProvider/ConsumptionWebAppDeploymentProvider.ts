import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('azure-pipelines-task-lib/task');
import { AzureAppService } from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/azure-arm-app-service';
import { AzureAppServiceUtility } from 'azure-pipelines-tasks-azurermdeploycommon-v3/operations/AzureAppServiceUtility';
import { PackageType } from 'azure-pipelines-tasks-azurermdeploycommon-v3/webdeployment-common/packageUtility';
import { sleepFor } from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/webClient';
import Q = require('q');
var webCommonUtility = require('azure-pipelines-tasks-azurermdeploycommon-v3/webdeployment-common/utility.js');
var zipUtility = require('azure-pipelines-tasks-azurermdeploycommon-v3/webdeployment-common/ziputility.js');
var azureStorage = require('azure-storage');
import * as ParameterParser from 'azure-pipelines-tasks-azurermdeploycommon-v3/operations/ParameterParserUtility';

export class ConsumptionWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider {

    public async PreDeploymentStep() {
        this.appService = new AzureAppService(this.taskParams.azureEndpoint, this.taskParams.ResourceGroupName, this.taskParams.WebAppName, 
            this.taskParams.SlotName, this.taskParams.WebAppKind, true);
        this.appServiceUtility = new AzureAppServiceUtility(this.appService);
    }
 
    public async DeployWebAppStep() {
        let storageDetails =  await this.findStorageAccount();
        let sasUrl = await this.uploadPackage(storageDetails, this.taskParams.Package);
        let userDefinedAppSettings = this._getUserDefinedAppSettings();
        await this.publishRunFromPackage(sasUrl, userDefinedAppSettings);

        await this.PostDeploymentStep();
    }

    private async findStorageAccount() {
        let appSettings = await this.appService.getApplicationSettings();
        var storageData = {};
        if(appSettings && appSettings.properties && appSettings.properties.AzureWebJobsStorage) {
            let webStorageSetting = appSettings.properties.AzureWebJobsStorage;
            let dictionary = getKeyValuePairs(webStorageSetting);
            tl.debug(`Storage Account is: ${dictionary["AccountName"]}`);
            storageData["AccountName"] = dictionary["AccountName"];
            storageData["AccountKey"] = dictionary["AccountKey"];
        }
        if(!storageData["AccountName"] || !storageData["AccountKey"]) {
            throw new Error(tl.loc('FailedToGetStorageAccountDetails'));
        }
        return storageData;
    }

    private async uploadPackage(storageDetails, deployPackage) : Promise<string> {
        let defer = Q.defer<string>();
        let storageAccount = storageDetails["AccountName"];
        let storageKey = storageDetails["AccountKey"];
        const blobService = azureStorage.createBlobService(storageAccount, storageKey);

        const containerName: string = 'azure-pipelines-deploy';
        const blobName: string = `package_${Date.now()}.zip`;
        let fileName;

        switch(deployPackage.getPackageType()){
            case PackageType.folder:
                let tempPackagePath = webCommonUtility.generateTemporaryFolderOrZipPath(tl.getVariable('AGENT.TEMPDIRECTORY'), false);
                let archivedWebPackage;
                try {
                    archivedWebPackage = await zipUtility.archiveFolder(deployPackage.getPath(), "", tempPackagePath);
                }
                catch(error) {
                    defer.reject(error);
                }
                tl.debug("Compressed folder into zip " +  archivedWebPackage);
                fileName = archivedWebPackage;
            break;
            case PackageType.zip:
                fileName = deployPackage.getPath();
            break;
            default:
                throw new Error(tl.loc('Invalidwebapppackageorfolderpathprovided', deployPackage.getPath()));
        }

        blobService.createContainerIfNotExists(containerName, error => {
            if (error){
                defer.reject(error);
            }

            //upoading package
            blobService.createBlockBlobFromLocalFile(containerName, blobName, fileName, (error, result) => {
                if (error) {
                    defer.reject(error);
                }

                //generating SAS URL
                let startDate = new Date();
                let expiryDate = new Date(startDate);
                expiryDate.setFullYear(startDate.getUTCFullYear() + 1);
                startDate.setMinutes(startDate.getMinutes()-5);
            
                let sharedAccessPolicy = {
                    AccessPolicy: {
                        Permissions: azureStorage.BlobUtilities.SharedAccessPermissions.READ,
                        Start: startDate,
                        Expiry: expiryDate
                    }
                };
            
                let token = blobService.generateSharedAccessSignature(containerName, blobName, sharedAccessPolicy);
                let sasUrl = blobService.getUrl(containerName, blobName, token);
                let index = sasUrl.indexOf("?");
                let sasToken: string = sasUrl.substring(index + 1);
                tl.setVariable('SAS_TOKEN', sasToken, true);
                tl.debug(`SAS URL is: ${sasUrl}`);
                defer.resolve(sasUrl);
            });
        });

        return defer.promise;
    }

    private async publishRunFromPackage(sasUrl, additionalAppSettings) {
        additionalAppSettings = !!additionalAppSettings ? additionalAppSettings : {};
        additionalAppSettings['WEBSITE_RUN_FROM_PACKAGE'] = sasUrl;

        console.log(tl.loc('UpdatingAppServiceApplicationSettings', JSON.stringify(additionalAppSettings)));
        await this.appService.patchApplicationSettings(additionalAppSettings);
        console.log(tl.loc('UpdatedOnlyAppServiceApplicationSettings'));
        console.log(tl.loc('UpdatedRunFromPackageSettings',sasUrl));
        await sleepFor(5);
        console.log(tl.loc('SyncingFunctionTriggers'));
        await this.appService.syncFunctionTriggers();
        console.log(tl.loc('SyncFunctionTriggersSuccess'));
    }

    protected async PostDeploymentStep() {
        if(this.taskParams.ConfigurationSettings) {
            var customApplicationSettings = ParameterParser.parse(this.taskParams.ConfigurationSettings);
            await this.appServiceUtility.updateConfigurationSettings(customApplicationSettings);
        }

        await this.appServiceUtility.updateScmTypeAndConfigurationDetails();
    }

    private _getUserDefinedAppSettings() {
        let userDefinedAppSettings = {};
        if(this.taskParams.AppSettings) {
            var customApplicationSettings = ParameterParser.parse(this.taskParams.AppSettings);
            for(var property in customApplicationSettings) {
                if(!!customApplicationSettings[property] && customApplicationSettings[property].value !== undefined) {
                    userDefinedAppSettings[property] = customApplicationSettings[property].value;
                }
            }
        }

        return userDefinedAppSettings;
    }
}

function getKeyValuePairs(webStorageSetting : string) {
    let keyValuePair = {};
    var splitted = webStorageSetting.split(";");
    for(var keyValue of splitted) {
        let indexOfSeparator = keyValue.indexOf("=");
        let key: string = keyValue.substring(0,indexOfSeparator);
        let value: string = keyValue.substring(indexOfSeparator + 1);
        keyValuePair[key] = value;
    }
    return keyValuePair;
}