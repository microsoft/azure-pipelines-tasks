import tl = require('azure-pipelines-task-lib/task');
import { Package, PackageType } from 'webdeployment-common-v2/packageUtility';

export class TaskParametersUtility {
    public static getParameters(): TaskParameters {
        var taskParameters: TaskParameters = {
           
            ConnectedServiceName: tl.getInput('ConnectedServiceName', true),
            SpringCloudResourceId: tl.getInput('SpringCloudService', true),
            AppName: tl.getInput('AppName', true),
            JarPath: tl.getInput('jarPath', true),
            SourceDirectory: tl.getPathInput('SourceDirectory', false),
            EnvironmentVariables: tl.getInput('EnvironmentVariables', false),
            JvmOptions: tl.getInput('JvmOptions', false),
            RuntimeVersion: RuntimeVersion[tl.getInput('RuntimeVersion', true)],
            Version: tl.getInput('Version', false),
            Verbose: tl.getBoolInput('Verbose',false)
        }
        return taskParameters;
    }

}

export enum RuntimeVersion {
    java8, 
    java11
}

export interface TaskParameters {
    ConnectedServiceName?: string;
    SpringCloudResourceId?: string;
    AppName?: string;
    DeploymentName?: string;
    JarPath?: string;
    SourceDirectory?: string;
    EnvironmentVariables?: string;
    JvmOptions?: string;
    RuntimeVersion?: RuntimeVersion;
    Version?: string;
    Verbose?: boolean;
}