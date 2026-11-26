'use strict';

import * as yaml from 'js-yaml';
import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from "azure-pipelines-task-lib/toolrunner";
import { CommandHelper } from './utils/commandHelper';
import { DockerConnection } from './dockerConnection';
import { Kubectl, Resource } from 'azure-pipelines-tasks-kubernetes-common/kubectl-object-model';
import * as FileHelper from './utils/fileHelper';
import * as KubernetesConstants from 'azure-pipelines-tasks-kubernetes-common/kubernetesconstants';
import * as KubernetesManifestUtility from 'azure-pipelines-tasks-kubernetes-common/kubernetesmanifestutility';
import ClusterConnection from './clusterconnection';

const secretName = tl.getInput('secretName');
const appName = tl.getInput('appName', true);
const namespace = getKubernetesNamespace();
const dockerHubNamespace = tl.getInput('dockerHubNamespace');
const args = tl.getInput('arguments');
const funcRootDir = tl.getInput('functionRootDirectory', true);
const waitForStability = tl.getBoolInput('waitForStability');
const isDryRun = (args && args.includes('--dry-run')) ? true : false;

export async function deploy(commandHelper: CommandHelper, dockerConnection: DockerConnection) {
    let pullSecretName: string = '';
    if (!isDryRun) {
        // create pull secret if it is not dry-run
        pullSecretName = createImagePullSecret(commandHelper);
    }

    // invoke func kubernetes deploy
    funcDeploy(commandHelper, dockerConnection, pullSecretName);

    if (!isDryRun) {
        // get Kubernetes resources (as YAML) created by deployment
        const kubernetesResourcesYaml = getKubernetesResourcesYaml(commandHelper, dockerConnection, pullSecretName);

        // annotate the resources
        annotateKubernetesResources(commandHelper, kubernetesResourcesYaml);

        if (waitForStability) {
            // wait for deployment to get stable
            const kubernetesResources = getResourcesFromYaml(kubernetesResourcesYaml, KubernetesConstants.deploymentTypes);
            await checkManifestStability(commandHelper, kubernetesResources);
        }
    }
}

function createImagePullSecret(commandHelper: CommandHelper): string {
    let pullSecretName = `${appName}-imagepullsecret`;
    const createPullSecretCommand = commandHelper.getCreateDockerRegistrySecretCommand(pullSecretName, namespace);
    if (createPullSecretCommand) {
        const deleteSecretCommand = commandHelper.getDeleteSecretCommand(pullSecretName, namespace);
        // while deleting, error is thrown if the secret is not present. Ignore the error.
        // kubectl's own output here is not expected to reflect untrusted repo content, but it is
        // still sanitized for defense-in-depth consistency with the other execCommand() call sites.
        commandHelper.execCommand(deleteSecretCommand, { failOnStdErr: false, ignoreReturnCode: true, externalOutput: { source: 'childProcess' } } as tr.IExecOptions, true);
        commandHelper.execCommand(createPullSecretCommand, { externalOutput: { source: 'childProcess' } } as tr.IExecOptions);
        // Built and run via commandHelper.execCommand (instead of the shared Kubectl helper's
        // annotate()) so this call stays under the same EnableOutputSanitization flag as every
        // other command here, rather than relying on the common package's own unconditional
        // sanitization. warnIfError=true preserves the original kubectl.annotate() call's
        // fire-and-forget semantics (its result was previously discarded entirely, e.g. a
        // re-deploy hitting an already-annotated secret without --overwrite would error but never
        // fail the task) - execCommand() always runs checkForErrors(), so without warnIfError=true
        // this would newly fail the task on a case that was previously silently ignored.
        const annotateSecretCommand = commandHelper.getAnnotateSecretCommand(pullSecretName, namespace, KubernetesConstants.pipelineAnnotations);
        commandHelper.execCommand(annotateSecretCommand, { externalOutput: { source: 'childProcess' } } as tr.IExecOptions, true);
    }
    else {
        // no secret created if no Docker login is found. Case when user wants to use a public image.
        pullSecretName = '';
    }

    return pullSecretName;
}

function funcDeploy(commandHelper: CommandHelper, dockerConnection: DockerConnection, pullSecretName: string) {
    const funcDeployCommand = commandHelper.getFuncDeployCommand(dockerConnection, secretName, appName, namespace, dockerHubNamespace, pullSecretName, args);
    // 'func kubernetes deploy' builds the user's Dockerfile/repo content. Its output is untrusted
    // and must not be allowed to inject logging commands (##vso[...]) into the agent.
    commandHelper.execCommand(funcDeployCommand, { cwd: funcRootDir, externalOutput: { source: 'childProcess' } } as tr.IExecOptions);
}

function annotateKubernetesResources(commandHelper: CommandHelper, resourcesYaml: string) {
    const funcKubernetesTemplatesPath = FileHelper.getFuncKubernetesYamlPath();
    FileHelper.writeContentToFile(funcKubernetesTemplatesPath, resourcesYaml);
    // Built and run via commandHelper.execCommand (instead of the shared Kubectl helper's
    // annotateFiles()) so this call stays under the same EnableOutputSanitization flag as every
    // other command here, rather than relying on the common package's own unconditional
    // sanitization. execCommand() already calls checkForErrors() internally.
    const annotateFilesCommand = commandHelper.getAnnotateResourceFileCommand(funcKubernetesTemplatesPath, namespace, KubernetesConstants.pipelineAnnotations);
    commandHelper.execCommand(annotateFilesCommand, { externalOutput: { source: 'childProcess' } } as tr.IExecOptions);
}

async function checkManifestStability(commandHelper: CommandHelper, resources: Resource[]) {
    const kubectl = new Kubectl(commandHelper.kubectlPath, namespace);
    await KubernetesManifestUtility.checkManifestStability(kubectl, resources);
}

function getKubernetesResourcesYaml(commandHelper: CommandHelper, dockerConnection, pullSecretName: string): string {
    let resourcesYaml = null;
    const argsWithDryRun = args ? args.concat(' --dry-run') : '--dry-run';
    const funcDeployDryRunCommand = commandHelper.getFuncDeployCommand(dockerConnection, secretName, appName, namespace, dockerHubNamespace, pullSecretName, argsWithDryRun);
    // Same untrusted build output concern as funcDeploy() above.
    const result: tr.IExecSyncResult = commandHelper.execCommand(funcDeployDryRunCommand, { cwd: funcRootDir, externalOutput: { source: 'childProcess' } } as tr.IExecOptions);
    resourcesYaml = result.stdout;

    return resourcesYaml;
}

function getResourcesFromYaml(yamlContent: string, filterResourceTypes: string[]): Resource[] {
    const resources: Resource[] = [];
    yaml.safeLoadAll(yamlContent, function (inputObject) {
        const inputObjectKind: string = inputObject ? inputObject.kind : '';
        if (inputObjectKind && filterResourceTypes.filter(type => inputObjectKind.toLowerCase() === type.toLowerCase()).length > 0) {
            const resource = {
                type: inputObject.kind,
                name: inputObject.metadata.name
            };
            resources.push(resource);
        }
    });

    return resources;
}

function getKubernetesNamespace(): string {
    let namespace = tl.getInput('namespace');
    if (!namespace) {
        const kubeConnection = tl.getInput('kubernetesServiceConnection', false);
        if (kubeConnection) {
            namespace = tl.getEndpointDataParameter(kubeConnection, 'namespace', true);
        }
    }

    return namespace;
}