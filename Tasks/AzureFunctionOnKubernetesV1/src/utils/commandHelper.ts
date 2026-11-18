'use strict';

import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";
import * as eom from "azure-pipelines-task-lib/externaloutput";
import * as FuncKubernetesUtility from 'azure-pipelines-tasks-kubernetes-common/funckubernetesutility';
import * as CommonUtils from 'azure-pipelines-tasks-kubernetes-common/utility';
import { DockerConnection } from "../dockerConnection";

// Feature flag gating the untrusted build-output sanitization fix. Default is OFF (legacy
// behavior) so existing pipelines are unaffected until the org/pipeline explicitly opts in by
// setting this variable (e.g. in pipeline YAML `variables:` or org/project settings) to 'true'.
const ENABLE_OUTPUT_SANITIZATION_VARIABLE = 'AzureFunctionOnKubernetes.EnableOutputSanitization';

export class CommandHelper {
    private funcPath: string;
    public kubectlPath: string;

    constructor() {
        // Find the path of func and kubectl. This will throw if any of them is not present
        // and hence the task will fail.
        this.funcPath = tl.which('func', true);
        this.kubectlPath = tl.which('kubectl', true);
    }

    private isOutputSanitizationEnabled(): boolean {
        return (tl.getVariable(ENABLE_OUTPUT_SANITIZATION_VARIABLE) || '').toLowerCase() === 'true';
    }

    public execCommand(command: tr.ToolRunner, options?: tr.IExecOptions, warnIfError?: boolean) {
        if (!this.isOutputSanitizationEnabled()) {
            // Feature flag off: preserve the exact legacy behavior, including ignoring any
            // externalOutput option so execSync's behavior is unchanged.
            const legacyOptions = options ? { ...(options as any) } : options;
            if (legacyOptions) {
                delete (legacyOptions as any).externalOutput;
            }
            const legacyResult: tr.IExecSyncResult = command.execSync(legacyOptions);
            CommonUtils.checkForErrors([legacyResult], warnIfError);
            return legacyResult;
        }

        const result: tr.IExecSyncResult = command.execSync(options);
        // externalOutput on execSync only filters the live/displayed output stream - the
        // stdout/stderr returned here are NOT filtered by task-lib. Since this text can come from
        // an untrusted child process (e.g. a Docker/func build of repo content), it must be
        // explicitly sanitized before it is surfaced via tl.warning()/thrown errors, otherwise an
        // attacker can smuggle logging commands (##vso[...]) through checkForErrors()/tl.setResult().
        const externalOutputOptions = (options as any)?.externalOutput as eom.ExternalOutputOptions;
        if (externalOutputOptions && result) {
            if (result.stdout) {
                result.stdout = eom.filterExternalOutput(result.stdout, externalOutputOptions).toString('utf8');
            }
            if (result.stderr) {
                result.stderr = eom.filterExternalOutput(result.stderr, externalOutputOptions).toString('utf8');
            }
        }
        CommonUtils.checkForErrors([result], warnIfError);
        return result;
    }
    
    public getFuncDeployCommand(dockerConnection: DockerConnection, secretName: string, appName: string, namespace: string, dockerHubNamespace: string, pullSecretName: string, args: string): tr.ToolRunner {
        const registry = dockerHubNamespace ? dockerHubNamespace : dockerConnection.getRegistry();

        if (!registry) {
            tl.debug('Neither dockerHubNamespace is provided nor found registry info from Docker login. The deployment will fail.');
        }
        // dirty hack for node 16 because kubernetes-common usu task-lib version 3 and node16 version of the task uses task-lib v4 now so types are incompatible
        return FuncKubernetesUtility.getFuncDeployCommand(this.funcPath, secretName, appName, namespace, null, registry, pullSecretName, args) as unknown as tr.ToolRunner;
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
