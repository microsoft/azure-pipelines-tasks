import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import { AzureEndpoint } from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/azureModels';
import { AzureRMEndpoint, dispose } from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/azure-arm-endpoint';
import { AzureAppService } from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/azure-arm-app-service';
import { AzureAppServiceUtility } from 'azure-pipelines-tasks-azurermdeploycommon-v3/operations/AzureAppServiceUtility';
import { Resources } from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/azure-arm-resource';

export class AzureResourceFilterUtils {
    public static async getResourceGroupName(endpoint: AzureEndpoint, resourceType: string, resourceName: string): Promise<string> {
        var azureResources: Resources = new Resources(endpoint);
        var filteredResources: Array<any> = await azureResources.getResources(resourceType, resourceName);
        let resourceGroupName: string;
        if(!filteredResources || filteredResources.length == 0) {
            throw new Error(tl.loc('ResourceDoesntExist', resourceName));
        }
        else if(filteredResources.length == 1) {
            resourceGroupName = filteredResources[0].id.split("/")[4];
        }
        else {
            throw new Error(tl.loc('MultipleResourceGroupFoundForAppService', resourceName));
        }

        return resourceGroupName;
    }
}


async function main() {

    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        tl.setResourcePath(path.join( __dirname, 'node_modules/azure-pipelines-tasks-azurermdeploycommon/module.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var webAppName: string = tl.getInput('appName', true);
        var resourceGroupName: string = tl.getInput('resourceGroupName', false);
        var slotName: string = tl.getInput('slotName', false);
        var AppSettings: string = tl.getInput('appSettings', false);
        var ConfigurationSettings: string = tl.getInput('generalSettings', false);
        var ConnectionStrings: string = tl.getInput('connectionStrings', false);

        if(!AppSettings && !ConfigurationSettings && !ConnectionStrings) {
            throw Error(tl.loc("AppServiceSettingsNotEnabled"));
        }
        
        var azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(connectedServiceName).getEndpoint();
        console.log(tl.loc('GotconnectiondetailsforazureRMWebApp0', webAppName));
        if (!resourceGroupName) {
            resourceGroupName = await AzureResourceFilterUtils.getResourceGroupName(azureEndpoint, 'Microsoft.Web/Sites', webAppName);
        }
        tl.debug(`Resource Group: ${resourceGroupName}`);

        var appService: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, slotName);
        let appServiceUtility: AzureAppServiceUtility = new AzureAppServiceUtility(appService);

        var endpointTelemetry = '{"endpointId":"' + connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureRmWebAppDeployment]" + endpointTelemetry);

        if(AppSettings) {
            try {
                var customApplicationSettings = JSON.parse(AppSettings);
            }
            catch (error) {
                throw new Error(tl.loc("AppSettingInvalidJSON"));
            }
            await appServiceUtility.updateAndMonitorAppSettings(customApplicationSettings, null, true);
        }
        if(ConfigurationSettings) {
            try {
                var customConfigurationSettings = JSON.parse(ConfigurationSettings);
            }
            catch (error) {
                throw new Error(tl.loc("ConfigSettingInvalidJSON"));
            }
            await appServiceUtility.updateConfigurationSettings(customConfigurationSettings, true);
        }
        if(ConnectionStrings) {
            try {
                var customConnectionStrings = JSON.parse(ConnectionStrings);
            }
            catch (error) {
                throw new Error(tl.loc("ConnectionStringInvalidJSON"));
            }
            await appServiceUtility.updateConnectionStrings(customConnectionStrings);
        }
        
    }
    catch(error) {
        
        tl.setResult(tl.TaskResult.Failed, error);
    }
    finally {
        dispose();
    }
}

main();
