import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import { AzureEndpoint } from 'azurermdeploycommon/azure-arm-rest/azureModels';
import { AzureRMEndpoint } from 'azurermdeploycommon/azure-arm-rest/azure-arm-endpoint';
import { AzureAppService } from 'azurermdeploycommon/azure-arm-rest/azure-arm-app-service';
import * as ParameterParser from 'azurermdeploycommon/operations/ParameterParserUtility';
import { AzureAppServiceUtility } from 'azurermdeploycommon/operations/AzureAppServiceUtility';

const webAppKindMap = new Map([
    [ 'app', 'webApp' ],
    [ 'app,linux', 'webAppLinux' ]
]);

async function main() {
    let isDeploymentSuccess: boolean = true;

    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        tl.setResourcePath(path.join( __dirname, 'node_modules/azurermdeploycommon/module.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var webAppName: string = tl.getInput('WebAppName', true);
        var resourceGroupName: string = tl.getInput('ResourceGroupName', false);
        var slotName: string = tl.getInput('slotName', false);
        var AppSettings: string = tl.getInput('appSettings', false);
        var ConfigurationSettings: string = tl.getInput('configurationStrings', false);
        var ConnectionStrings: string = tl.getInput('connectionStrings', false);

        var azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(connectedServiceName).getEndpoint();
        console.log(tl.loc('GotconnectiondetailsforazureRMWebApp0', webAppName));

        var appService: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, slotName);
        var configSettings = await appService.get(true);
        var webAppKind = webAppKindMap.get(configSettings.kind) ? webAppKindMap.get(configSettings.kind) : configSettings.kind;
        let appServiceUtility: AzureAppServiceUtility = new AzureAppServiceUtility(appService);

        var endpointTelemetry = '{"endpointId":"' + connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureRmWebAppDeployment]" + endpointTelemetry);

        if(AppSettings) {
            var customApplicationSettings = JSON.parse(AppSettings);
            await appServiceUtility.updateAndMonitorAppSettings(customApplicationSettings, null, true);
        }

        if(ConfigurationSettings) {
            var customConfigurationSettings = JSON.parse(ConfigurationSettings);
            await appServiceUtility.updateConfigurationSettings(customConfigurationSettings, true);
        }
        if(ConnectionStrings) {
            var customConnectionStrings = JSON.parse(ConnectionStrings);
            await appServiceUtility.updateConnectionStrings(customConnectionStrings);
        }
        
        
    }
    catch(error) {
        
        tl.setResult(tl.TaskResult.Failed, error);
    }
    finally {
        
    }
}

main();
