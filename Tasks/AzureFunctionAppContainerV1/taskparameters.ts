import tl = require('vsts-task-lib/task');

export class TaskParametersUtility {

    public static async getParameters(): Promise<TaskParameters> {
        var taskParameters: TaskParameters = {
            connectedServiceName: tl.getInput('azureSubscription', true),
            ImageName: tl.getInput('imageName', true),
            AppSettings: tl.getInput('appSettings', false),
            StartupCommand: tl.getInput('containerCommand', false),
            ConfigurationSettings: tl.getInput('configurationStrings', false),
            WebAppName: tl.getInput('appName', true),
            ResourceGroupName: tl.getInput('resourceGroupName', false),
            SlotName:tl.getInput('slotName', false),
            DeployToSlotOrASEFlag: tl.getBoolInput('deployToSlotOrASE', false),
        }

        var endpointTelemetry = '{"endpointId":"' + taskParameters.connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureRmWebAppDeployment]" + endpointTelemetry);

        return taskParameters;
    }
}

export interface TaskParameters {
    connectedServiceName: string;
    WebAppName: string;
    ImageName: string;
    AppSettings?: string;
    StartupCommand?: string;
    ConfigurationSettings?: string;
    ResourceGroupName?: string;
    SlotName?: string;
    DeployToSlotOrASEFlag?: boolean;
    isLinuxContainerApp?: boolean;
}
