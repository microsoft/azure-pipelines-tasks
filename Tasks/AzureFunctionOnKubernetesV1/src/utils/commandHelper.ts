'use strict';

import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";
import * as eom from "azure-pipelines-task-lib/externaloutput";
import * as FuncKubernetesUtility from 'azure-pipelines-tasks-kubernetes-common/funckubernetesutility';
import * as CommonUtils from 'azure-pipelines-tasks-kubernetes-common/utility';
import { DockerConnection } from "../dockerConnection";

// Feature flag gating the untrusted build-output sanitization fix. Default is OFF (legacy
// behavior). This is a server-controlled pipeline feature (DistributedTask.Tasks.<name>,
// resolved via tl.getPipelineFeature()) that Microsoft ramps centrally per org/collection via
// Config Change - it is NOT a pipeline-author-set variable. The matching server-side
// registration (DistributedTaskFeatures.cs + FeatureAvailability servicing XML) is tracked as a
// separate follow-up to land after this PR merges and the rollout plan is finalized; until that
// registration exists, tl.getPipelineFeature() simply returns false (legacy behavior).
const ENABLE_OUTPUT_SANITIZATION_FEATURE = 'AzureFunctionOnKubernetes.EnableOutputSanitization';

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
        return tl.getPipelineFeature(ENABLE_OUTPUT_SANITIZATION_FEATURE);
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

        // Default externalOutput to a childProcess-sourced sanitization unless the caller
        // explicitly overrides it (including explicitly opting out), so a future call site can't
        // accidentally skip sanitization by simply forgetting to pass the option.
        const sanitizedOptions: tr.IExecOptions = { externalOutput: { source: 'childProcess' }, ...(options as any) } as tr.IExecOptions;
        const result: tr.IExecSyncResult = command.execSync(sanitizedOptions);
        // externalOutput on execSync only filters the live/displayed output stream - the
        // stdout/stderr returned here are NOT filtered by task-lib. Since this text can come from
        // an untrusted child process (e.g. a Docker/func build of repo content), it must be
        // explicitly sanitized before it is surfaced via tl.warning()/thrown errors, otherwise an
        // attacker can smuggle logging commands (##vso[...]) through checkForErrors()/tl.setResult().
        const externalOutputOptions = (sanitizedOptions as any)?.externalOutput as eom.ExternalOutputOptions;
        if (externalOutputOptions && result) {
            let neutralized = false;
            for (const stream of ['stdout', 'stderr'] as const) {
                const raw = result[stream];
                if (raw) {
                    const clean = eom.filterExternalOutput(raw, externalOutputOptions).toString('utf8');
                    neutralized = neutralized || clean !== raw;
                    result[stream] = clean;
                }
            }
            if (neutralized) {
                // Make the effect diagnosable: a pipeline that relies on a legitimate ##vso[...]
                // command embedded in func/Docker/kubectl output (e.g. a Dockerfile RUN step that
                // sets a variable for a later task) would otherwise silently stop working with no
                // explanation once this flag is on. Deliberately do not include the raw marker
                // text itself, so this message can't be used to smuggle a command.
                console.log('Logging-command markers in the output of an external tool were neutralized (AzureFunctionOnKubernetes.EnableOutputSanitization is on).');
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

    // Builds the same command the shared Kubectl helper's annotate('secret', ...) would have run,
    // but constructed locally so it is routed through execCommand() and stays under
    // EnableOutputSanitization flag control instead of the common package's own (unconditional)
    // sanitization.
    public getAnnotateSecretCommand(secretName: string, namespace: string, annotations: string[]): tr.ToolRunner {
        const command = tl.tool(this.kubectlPath);
        command.arg(['annotate', 'secret', secretName]);
        command.arg(annotations);
        command.arg(['--namespace', namespace || 'default']);

        return command;
    }

    // Builds the same command the shared Kubectl helper's annotateFiles(..., overwrite=true)
    // would have run, but constructed locally for the same flag-control reason as
    // getAnnotateSecretCommand() above.
    public getAnnotateResourceFileCommand(filePath: string, namespace: string, annotations: string[]): tr.ToolRunner {
        const command = tl.tool(this.kubectlPath);
        command.arg(['annotate', '-f', filePath]);
        command.arg(annotations);
        command.arg('--overwrite');
        command.arg(['--namespace', namespace || 'default']);

        return command;
    }
}
