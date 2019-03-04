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
        let appSettings = await this.appService.getApplicationSettings();
        if(appSettings && appSettings.properties) {
            if(appSettings.properties.AzureWebJobsStorage) {
                var str = appSettings.properties.AzureWebJobsStorage;
                let dictionary: [string, string] = keyValuePairs(str);
                tl.debug(`Storage Account is: ${dictionary["AccountName"]}`);
            }
        }
    }
}

function keyValuePairs(str : string) : [string, string]{
    let keyValuePair: [string, string] = ['',''];
    var splitted = str.split(";");
    for (let i = 0; i < splitted.length; i++) {
        var keyValue = splitted[i];
        var indexOfSeparator = keyValue.indexOf("=");
        var key : string = keyValue.substring(0,indexOfSeparator);
        var value : string = keyValue.substring(indexOfSeparator + 1);
        keyValuePair[key] = value;
    }
    return keyValuePair;
}