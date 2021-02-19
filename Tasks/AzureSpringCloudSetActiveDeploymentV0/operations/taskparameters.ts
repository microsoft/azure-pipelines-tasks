import tl = require('azure-pipelines-task-lib/task');
import { Package, PackageType } from 'webdeployment-common-v2/packageUtility';

export class TaskParametersUtility {
    public static getParameters(): TaskParameters {
        var taskParameters: TaskParameters = {
           
            ConnectedServiceName: tl.getInput('ConnectedServiceName', true),
            SpringCloudResourceId: tl.getInput('SpringCloudService', true),
            AppName: tl.getInput('AppName', true),
            DeploymentName: tl.getInput('DeploymentName', true),
            Verbose: tl.getBoolInput('Verbose',false)
        }
        return taskParameters;
    }
}

export interface TaskParameters {
    ConnectedServiceName?: string;
    SpringCloudResourceId?: string;
    AppName?: string;
    DeploymentName: string;
    Verbose?: boolean;
}