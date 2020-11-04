import tl = require('azure-pipelines-task-lib/task');

export class TaskParametersUtility {
    public static getParameters(): TaskParameters {
        var taskParameters: TaskParameters = {
            ResourceGroupName: tl.getInput('ResourceGroupName', true),
            ServiceName: tl.getInput('ServiceName', true),
            AppName: tl.getInput('AppName', true),
            DeploymentName: tl.getInput('DocumentName', true),
            JarPath: tl.getPathInput('JarPath', false),
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

    ResourceGroupName?: string;
    ServiceName?: string;
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