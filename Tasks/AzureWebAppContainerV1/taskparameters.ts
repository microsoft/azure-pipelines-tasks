import tl = require('vsts-task-lib/task');
import { AzureResourceFilterUtility } from 'azurermdeploycommon/operations/AzureResourceFilterUtility';
import { AzureEndpoint } from 'azurermdeploycommon/azure-arm-rest/azureModels';
import { AzureRMEndpoint } from 'azurermdeploycommon/azure-arm-rest/azure-arm-endpoint';
import { AzureAppService } from 'azurermdeploycommon/azure-arm-rest/azure-arm-app-service';

const osTypeMap = new Map([
    [ 'app,conatiner,xenon', 'Windows' ],
    [ 'app,linux,container', 'Linux' ]
]);

export class TaskParametersUtility {

    public static async getParameters(): Promise<TaskParameters> {
        var taskParameters: TaskParameters = {
            connectedServiceName: tl.getInput('azureSubscription', true),
            ImageName: tl.getInput('imageName', true),
            AppSettings: tl.getInput('appSettings', false),
            StartupCommand: tl.getInput('containerCommand', false),
            ConfigurationSettings: tl.getInput('configurationStrings', false),
            WebAppName: tl.getInput('appName', true),
            OSType: tl.getInput('osType', false),
            DeployToSlotOrASEFlag: tl.getBoolInput('deployToSlotOrASE', false),
            ResourceGroupName: tl.getInput('resourceGroupName', false),
            SlotName:tl.getInput('slotName', false)
        }

        taskParameters.azureEndpoint = await new AzureRMEndpoint(taskParameters.connectedServiceName).getEndpoint();
        console.log(tl.loc('GotconnectiondetailsforazureRMWebApp0', taskParameters.WebAppName));

        let appDetails = await this.getWebAppKind(taskParameters);
        taskParameters.ResourceGroupName = appDetails["resourceGroupName"];
        taskParameters.OSType = appDetails["osType"];
        taskParameters.isLinuxContainerApp = taskParameters.OSType && taskParameters.OSType.indexOf("Linux") !=-1;

        var endpointTelemetry = '{"endpointId":"' + taskParameters.connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureRmWebAppDeployment]" + endpointTelemetry);

        return taskParameters;
    }

    private static async getWebAppKind(taskParameters: TaskParameters): Promise<any> {
        var resourceGroupName = taskParameters.ResourceGroupName;
        var osType = taskParameters.OSType;
        if (!resourceGroupName) {
            var appDetails = await AzureResourceFilterUtility.getAppDetails(taskParameters.azureEndpoint, taskParameters.WebAppName);
            resourceGroupName = appDetails["resourceGroupName"];
            if(!osType) {
                osType = osTypeMap.get(appDetails["kind"]) ? osTypeMap.get(appDetails["kind"]) : appDetails["kind"];
            }
            
            tl.debug(`Resource Group: ${resourceGroupName}`);
        }
        else if(!osType) {
            var appService = new AzureAppService(taskParameters.azureEndpoint, taskParameters.ResourceGroupName, taskParameters.WebAppName);
            var configSettings = await appService.get(true);
            osType = osTypeMap.get(configSettings.kind) ? osTypeMap.get(configSettings.kind) : configSettings.kind;
        }
        return {
            resourceGroupName: resourceGroupName,
            osType: osType
        };
    }
}

export interface TaskParameters {
    azureEndpoint?: AzureEndpoint;
    connectedServiceName: string;
    OSType: string;
    WebAppName: string;
    AppSettings?: string;
    StartupCommand?: string;
    ConfigurationSettings?: string;
    ImageName: string;
    ResourceGroupName?: string;
    DeployToSlotOrASEFlag?: boolean;
    SlotName?: string;
    isLinuxContainerApp?: boolean;
}
