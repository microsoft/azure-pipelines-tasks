import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";

export function getFuncDeployCommand(funcToolsPath: string, secretName: string, appName: string, namespace: string, imageName: string, registry: string, pullSecretName: string, args: string): tr.ToolRunner {
    const command = tl.tool(funcToolsPath);
    command.arg(['kubernetes', 'deploy']);
    command.arg(['--name', appName]);

    if (namespace) {
        command.arg(['--namespace', namespace]);
    }

    if (imageName) {
        command.arg(['--image-name', imageName]);
    }
    else if (registry){
        command.arg(['--registry', registry]);
    }

    if (pullSecretName) {
        command.arg(['--pull-secret', pullSecretName]);
    }

    if (secretName) {
        command.arg(['--secret-name', secretName]);
    }

    command.line(args);
    return command;
}