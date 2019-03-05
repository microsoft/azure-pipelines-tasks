import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import { AzureAppService } from 'azurermdeploycommon/azure-arm-rest/azure-arm-app-service';
import { AzureAppServiceUtility } from 'azurermdeploycommon/operations/AzureAppServiceUtility';

export class ConsumptionWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider {

    public async PreDeploymentStep() {
        this.appService = new AzureAppService(this.taskParams.azureEndpoint, this.taskParams.ResourceGroupName, this.taskParams.WebAppName, 
            this.taskParams.SlotName, this.taskParams.WebAppKind);
        this.appServiceUtility = new AzureAppServiceUtility(this.appService);
    }
 
    public async DeployWebAppStep() {
        var storageDetails =  await this.findStorageAccount();
    }

    private async findStorageAccount() {
        let appSettings = await this.appService.getApplicationSettings();
        var storageData = {};
        if(appSettings && appSettings.properties && appSettings.properties.AzureWebJobsStorage) {
            let str = appSettings.properties.AzureWebJobsStorage;
            let dictionary = getKeyValuePairs(str);
            tl.debug(`Storage Account is: ${dictionary["AccountName"]}`);
            storageData["AccountName"] = dictionary["AccountName"];
            storageData["AccountKey"] = dictionary["AccountKey"];
        }
        else {
            throw new Error(tl.loc('FailedToGetStorageAccountDetails'));
        }
        return storageData;
    }
}

function getKeyValuePairs(str : string) {
    let keyValuePair = {};
    var splitted = str.split(";");
    for(var keyValue of splitted) {
        let indexOfSeparator = keyValue.indexOf("=");
        let key : string = keyValue.substring(0,indexOfSeparator);
        let value : string = keyValue.substring(indexOfSeparator + 1);
        keyValuePair[key] = value;
    }
    return keyValuePair;
}