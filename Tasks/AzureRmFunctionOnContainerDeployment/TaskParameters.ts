import tl = require('vsts-task-lib/task');
import { AzureRMEndpoint } from 'azurermdeploycommon/azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azurermdeploycommon/azure-arm-rest/azureModels';
import { AzureResourceFilterUtility } from 'azurermdeploycommon/operations/AzureResourceFilterUtility';
import { AzureAppService } from 'azurermdeploycommon/azure-arm-rest/azure-arm-app-service';

export enum DeploymentType {
    webDeploy,
    zipDeploy,
    runFromZip,
    warDeploy
}

const webAppKindMap = new Map([
    [ 'app,linux,container', 'webAppContainer' ],
    [ 'functionapp,linux,container', 'functionAppContainer' ]
]);

export class TaskParametersUtility {

    public static async getParameters(): Promise<TaskParameters> {
        var taskParameters: TaskParameters = {
            connectedServiceName: tl.getInput('ConnectedServiceName', false),
            WebAppKind: tl.getInput('WebAppKind', false),
            DockerNamespace: tl.getInput('DockerNamespace', false),
            AppSettings: tl.getInput('AppSettings', false),
            StartupCommand: tl.getInput('StartupCommand', false),
            ConfigurationSettings: tl.getInput('ConfigurationSettings', false),
            WebAppName: tl.getInput('WebAppName', true),
            ResourceGroupName: tl.getInput('ResourceGroupName', false)
        }

        taskParameters.azureEndpoint = await new AzureRMEndpoint(taskParameters.connectedServiceName).getEndpoint();
        console.log(tl.loc('GotconnectiondetailsforazureRMWebApp0', taskParameters.WebAppName));   

        if (!taskParameters.ResourceGroupName) {
            var appDetails = await AzureResourceFilterUtility.getAppDetails(taskParameters.azureEndpoint, taskParameters.WebAppName);
            taskParameters.ResourceGroupName = appDetails["resourceGroupName"];
            taskParameters.WebAppKind = taskParameters.WebAppKind ? taskParameters.WebAppKind : webAppKindMap.get(appDetails["kind"]);
            tl.debug(`Resource Group: ${taskParameters.ResourceGroupName}`);
        }
        else if(!taskParameters.WebAppKind){
            var appService = new AzureAppService(taskParameters.azureEndpoint, taskParameters.ResourceGroupName, taskParameters.WebAppName);
            var configSettings = await appService.get(true);
            taskParameters.WebAppKind = webAppKindMap.get(configSettings.kind);
        }

        taskParameters.isFunctionApp = taskParameters.WebAppKind.indexOf("function") != -1;

        var endpointTelemetry = '{"endpointId":"' + taskParameters.connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureRmWebAppDeployment]" + endpointTelemetry);

        return taskParameters;
    }
}

export interface TaskParameters {
    connectedServiceName: string;
    WebAppName: string;
    WebAppKind?: string;
    AppSettings?: string;
    StartupCommand?: string;
    ConfigurationSettings?: string;
    DockerNamespace?: string;
    ResourceGroupName?: string;
    /** Additional parameters */
    azureEndpoint?: AzureEndpoint;
    isFunctionApp?: boolean;
}
