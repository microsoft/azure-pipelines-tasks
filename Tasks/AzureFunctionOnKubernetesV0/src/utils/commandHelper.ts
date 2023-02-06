import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";
import * as FuncKubernetesUtility from 'azure-pipelines-tasks-kubernetes-common-v2/funckubernetesutility';
import * as CommonUtils from 'azure-pipelines-tasks-kubernetes-common-v2/utility';
import { DockerConnection } from "../dockerConnection";

export class CommandHelper {
    private funcPath: string;
    public kubectlPath: string;

    constructor() {
        // Find the path of func and kubectl. This will throw if any of them is not present
        // and hence the task will fail.
        this.funcPath = tl.which('func', true);
        this.kubectlPath = tl.which('kubectl', true);
    }

    public execCommand(command: any, options?: tr.IExecOptions, warnIfError?: boolean) {
        const result: tr.IExecSyncResult = command.execSync(options);
        CommonUtils.checkForErrors([result], warnIfError);
        return result;
    }
    
    public getFuncDeployCommand(dockerConnection: DockerConnection, secretName: string, appName: string, namespace: string, dockerHubNamespace: string, pullSecretName: string, args: string) {
        const registry = dockerHubNamespace ? dockerHubNamespace : dockerConnection.getRegistry();

        if (!registry) {
            tl.debug('Neither dockerHubNamespace is provided nor found registry info from Docker login. The deployment will fail.');
        }

        return FuncKubernetesUtility.getFuncDeployCommand(this.funcPath, secretName, appName, namespace, null, registry, pullSecretName, args);
    }

    public getCreateDockerRegistrySecretCommand(secretName: string, namespace: string): tr.ToolRunner {
        const dockerConfigDir = tl.getVariable('DOCKER_CONFIG');
        if (dockerConfigDir) {
            const command = tl.tool(this.kubectlPath);
            const dockerConfigPath = path.join(dockerConfigDir, 'config.json');
            command.arg(['create', 'secret', 'generic']);
            command.arg(secretName);
            command.arg(`--from-file=.dockerconfigjson=${dockerConfigPath}`);
            command.arg('--type=kubernetes.io/dockerconfigjson');
            if (namespace) {
                command.arg(['--namespace', namespace]);
            }

            return command;
        }
        else {
            tl.debug('Not creating any pull-secret as no Docker login found.');
            return null;
        }
    }

    public getDeleteSecretCommand(secretName: string, namespace: string): tr.ToolRunner {
        const command = tl.tool(this.kubectlPath);
        command.arg(['delete', 'secret', secretName]);
        if (namespace) {
            command.arg(['--namespace', namespace]);
        }

        return command;
    }
}