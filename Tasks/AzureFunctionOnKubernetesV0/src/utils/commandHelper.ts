import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";
import * as path from "path";
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

    public checkForErrors(execResults: tr.IExecSyncResult[], warnIfError?: boolean) {
        if (execResults.length !== 0) {
            let stderr = '';
            execResults.forEach(result => {
                if (result.stderr) {
                    if (result.code !== 0) {
                        stderr += result.stderr + '\n';
                    } else {
                        tl.warning(result.stderr);
                    }
                }
            });
            if (stderr.length > 0) {
                if (!!warnIfError) {
                    tl.warning(stderr.trim());
                } else {
                    throw new Error(stderr.trim());
                }
            }
        }
    }

    public execCommand(command: tr.ToolRunner, options?: tr.IExecOptions, warnIfError?: boolean) {
        const result: tr.IExecSyncResult = command.execSync(options);
        this.checkForErrors([result], warnIfError);
        return result;
    }
    
    public getFuncDeployCommand(dockerConnection: DockerConnection, secretName: string, appName: string, namespace: string, imageName: string, registry: string, pullSecretName: string, args: string): tr.ToolRunner {
        const command = tl.tool(this.funcPath);
        command.arg(['kubernetes', 'deploy']);
        command.arg(['--name', appName]);

        if (namespace) {
            command.arg(['--namespace', namespace]);
        }

        if (imageName) {
            command.arg(['--image-name', imageName]);
        }
        else {
            if (!registry) {
                registry = dockerConnection.getRegistry();
            }

            if (registry) {
                command.arg(['--registry', registry]);
            }
            else {
                tl.debug('Neither image-name nor registry input is provided. The deployment will fail if one of these is not specified in arguments');
            }
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

    public getCreateDockerRegistrySecretCommand(secretName: string, namespace: string): tr.ToolRunner {
        const command = tl.tool(this.kubectlPath);
        const dockerConfigDir = tl.getVariable('DOCKER_CONFIG');
        if (dockerConfigDir) {
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