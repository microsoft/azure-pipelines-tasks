import tl = require('vsts-task-lib/task');

export class TaskParametersUtility {

    public static async getParameters(): Promise<TaskParameters> {
        var taskParameters: TaskParameters = {
            connectedServiceName: tl.getInput('ConnectedServiceName', true),
            ImageName: tl.getInput('imageName', true),
            AppSettings: tl.getInput('appSettings', false),
            StartupCommand: tl.getInput('containerCommand', false),
            ConfigurationSettings: tl.getInput('configurationStrings', false),
            WebAppName: tl.getInput('appName', true),
            DeployToSlotOrASEFlag: tl.getBoolInput('deployToSlotOrASE', false),
            ResourceGroupName: tl.getInput('resourceGroupName', false),
            SlotName:tl.getInput('slotName', false)
        }

        var endpointTelemetry = '{"endpointId":"' + taskParameters.connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureRmWebAppDeployment]" + endpointTelemetry);

        return taskParameters;
    }
}

export interface TaskParameters {
    connectedServiceName: string;
    WebAppName: string;
    AppSettings?: string;
    StartupCommand?: string;
    ConfigurationSettings?: string;
    ImageName?: string;
    ResourceGroupName?: string;
    DeployToSlotOrASEFlag?: boolean;
    SlotName?: string;
}
