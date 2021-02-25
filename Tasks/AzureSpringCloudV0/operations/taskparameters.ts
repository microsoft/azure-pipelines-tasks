import tl = require('azure-pipelines-task-lib/task');
import { Package, PackageType } from 'webdeployment-common-v2/packageUtility';

export class TaskParametersUtility {
    public static getParameters(): TaskParameters {
        var taskParameters: TaskParameters = {
            ConnectedServiceName: tl.getInput('ConnectedServiceName', true),
            SpringCloudResourceId: tl.getInput('SpringCloudService', true),
            Action: tl.getInput('Action', true),
            AppName: tl.getInput('AppName', true),
            TargetInactive: tl.getBoolInput('TargetInactive', true),
            CreateNewDeployment: tl.getBoolInput('CreateNewDeployment', false),
            DeploymentName: tl.getInput('DeploymentName', !tl.getBoolInput('TargetInactive', true)),
            EnvironmentVariables: tl.getInput('EnvironmentVariables', false),
            JvmOptions: tl.getInput('JvmOptions', false),
            RuntimeVersion: tl.getInput('RuntimeVersion', false),
            Version: tl.getInput('Version', false),
            Verbose: tl.getBoolInput('Verbose', false)
        }

        //Do not attempt to parse package in non-deployment steps. This causes variable substitution errors.
        if (taskParameters.Action == 'Deploy') {
            taskParameters.Package = new Package(tl.getPathInput('Package', true));
        }

        tl.debug('Task parameters: ' + JSON.stringify(taskParameters));
        return taskParameters;
    }
}


export interface TaskParameters {
    ConnectedServiceName?: string;
    Action: string;
    SpringCloudResourceId?: string;
    AppName: string;
    TargetInactive: boolean;
    CreateNewDeployment: boolean;
    DeploymentName: string;
    EnvironmentVariables?: string;
    Package?: Package;
    JvmOptions?: string;
    RuntimeVersion: string;
    Version?: string;
    Verbose?: boolean;
}