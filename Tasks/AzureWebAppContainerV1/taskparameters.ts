import tl = require('azure-pipelines-task-lib/task');
import { AzureResourceFilterUtility } from 'azure-pipelines-tasks-azurermdeploycommon/operations/AzureResourceFilterUtility';
import { AzureEndpoint } from 'azure-pipelines-tasks-azurermdeploycommon/azure-arm-rest/azureModels';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azurermdeploycommon/azure-arm-rest/azure-arm-endpoint';
import { AzureAppService } from 'azure-pipelines-tasks-azurermdeploycommon/azure-arm-rest/azure-arm-app-service';
import { PackageUtility } from 'azure-pipelines-tasks-azurermdeploycommon/webdeployment-common/packageUtility';
import fs = require('fs');

const osTypeMap = new Map([
    [ 'app,container,xenon', 'Windows' ],
    [ 'app,linux,container', 'Linux' ]
]);

export class TaskParametersUtility {

    public static async getParameters(): Promise<TaskParameters> {
        var taskParameters: TaskParameters = {
            connectedServiceName: tl.getInput('azureSubscription', true),
            ImageName: tl.getInput('imageName', false),
            AppSettings: tl.getInput('appSettings', false),
            StartupCommand: tl.getInput('containerCommand', false),
            ConfigurationSettings: tl.getInput('configurationStrings', false),
            WebAppName: tl.getInput('appName', true),
            DeployToSlotOrASEFlag: tl.getBoolInput('deployToSlotOrASE', false),
            ResourceGroupName: tl.getInput('resourceGroupName', false),
            SlotName: tl.getInput('slotName', false),
            MulticontainerConfigFile: tl.getPathInput('multicontainerConfigFile', false)
        }

        taskParameters.azureEndpoint = await new AzureRMEndpoint(taskParameters.connectedServiceName).getEndpoint();
        console.log(tl.loc('GotconnectiondetailsforazureRMWebApp0', taskParameters.WebAppName));

        let appDetails = await this.getWebAppKind(taskParameters);
        taskParameters.ResourceGroupName = appDetails["resourceGroupName"];
        taskParameters.OSType = appDetails["osType"];
        taskParameters.isLinuxContainerApp = taskParameters.OSType && taskParameters.OSType.toLowerCase().includes("linux");

        var endpointTelemetry = '{"endpointId":"' + taskParameters.connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureRmWebAppDeployment]" + endpointTelemetry);

        let containerDetails = await this.getContainerKind(taskParameters);
        taskParameters.ImageName = containerDetails["imageName"];
        taskParameters.isMultiContainer = containerDetails["isMultiContainer"];
        taskParameters. MulticontainerConfigFile = containerDetails["multicontainerConfigFile"];

        return taskParameters;
    }

    private static async getWebAppKind(taskParameters: TaskParameters): Promise<any> {
        let resourceGroupName: string = (taskParameters.DeployToSlotOrASEFlag) ? taskParameters.ResourceGroupName : "";
        let osType: string;
        if (!resourceGroupName) {
            var appDetails = await AzureResourceFilterUtility.getAppDetails(taskParameters.azureEndpoint, taskParameters.WebAppName);
            resourceGroupName = appDetails["resourceGroupName"];
            osType = osTypeMap.get(appDetails["kind"]) ? osTypeMap.get(appDetails["kind"]) : appDetails["kind"];
            
            tl.debug(`Resource Group: ${resourceGroupName}`);
        }
        else {
            var appService = new AzureAppService(taskParameters.azureEndpoint, taskParameters.ResourceGroupName, taskParameters.WebAppName);
            var configSettings = await appService.get(true);
            osType = osTypeMap.get(configSettings.kind) ? osTypeMap.get(configSettings.kind) : configSettings.kind;
        }
        
        return {
            resourceGroupName: resourceGroupName,
            osType: osType
        };
    }

    private static async getContainerKind(taskParameters: TaskParameters): Promise<any> {
        let imageName = taskParameters.ImageName;
        let isMultiLineImages: boolean = imageName && imageName.indexOf("\n") != -1; 
        let isMultiContainer = false;
        let multicontainerConfigFile = PackageUtility.getPackagePath(taskParameters.MulticontainerConfigFile);

        if(!imageName && tl.stats(multicontainerConfigFile).isDirectory()) {
            throw new Error(tl.loc('FailedToDeployToWebApp', taskParameters.WebAppName));
        }

        if(imageName && !isMultiLineImages && tl.stats(multicontainerConfigFile).isDirectory()) {
            console.log(tl.loc("SingleContainerDeployment", taskParameters.WebAppName));
        }

        if(tl.stats(multicontainerConfigFile).isFile()) {
            isMultiContainer = true;
            if(imageName) {
                console.log(tl.loc("MultiContainerDeploymentWithTransformation", taskParameters.WebAppName));
            }
            else {
                console.log(tl.loc("MultiContainerDeploymentWithoutTransformation", taskParameters.WebAppName));
            }
        }
        else if (isMultiLineImages) {
            throw new Error(tl.loc('FailedToGetConfigurationFile'));
        }

        tl.debug(`is multicontainer app : ${isMultiContainer}`);

        return {
            imageName: imageName,
            isMultiContainer: isMultiContainer,
            multicontainerConfigFile: multicontainerConfigFile
        };
    }
}

export interface TaskParameters {
    azureEndpoint?: AzureEndpoint;
    connectedServiceName: string;
    OSType?: string;
    WebAppName: string;
    AppSettings?: string;
    StartupCommand?: string;
    ConfigurationSettings?: string;
    ImageName: string;
    ResourceGroupName?: string;
    DeployToSlotOrASEFlag?: boolean;
    SlotName?: string;
    isLinuxContainerApp?: boolean;
    MulticontainerConfigFile?: string;
    isMultiContainer?: boolean;
}
