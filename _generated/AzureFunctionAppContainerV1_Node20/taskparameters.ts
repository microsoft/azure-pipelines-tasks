import tl = require('azure-pipelines-task-lib/task');

function convertToNullIfUndefined(arg: any): any {
    return arg ? arg : null;
}

export class TaskParametersUtility {

    public static async getParameters(): Promise<TaskParameters> {

        var taskParameters: TaskParameters = {
            connectedServiceName: tl.getInput('azureSubscription', true),
            ImageName: tl.getInput('imageName', true),
            AppSettings: convertToNullIfUndefined(tl.getInput('appSettings', false)),
            StartupCommand: convertToNullIfUndefined(tl.getInput('containerCommand', false)),
            ConfigurationSettings: convertToNullIfUndefined(tl.getInput('configurationStrings', false)),
            WebAppName: tl.getInput('appName', true),
            ResourceGroupName: convertToNullIfUndefined(tl.getInput('resourceGroupName', false)),
            SlotName:convertToNullIfUndefined(tl.getInput('slotName', false)),
            DeployToSlotOrASEFlag: convertToNullIfUndefined(tl.getBoolInput('deployToSlotOrASE', false)),
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
