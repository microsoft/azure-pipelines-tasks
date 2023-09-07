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
import * as CommonUtils from 'azure-pipelines-tasks-kubernetes-common/utility';

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
        commandHelper.execCommand(deleteSecretCommand, { failOnStdErr: false, ignoreReturnCode: true} as tr.IExecOptions, true);
        commandHelper.execCommand(createPullSecretCommand);
        const kubectl = new Kubectl(commandHelper.kubectlPath, namespace);
        kubectl.annotate('secret', pullSecretName, KubernetesConstants.pipelineAnnotations);
    }
    else {
        // no secret created if no Docker login is found. Case when user wants to use a public image.
        pullSecretName = '';
    }

    return pullSecretName;
}

function funcDeploy(commandHelper: CommandHelper, dockerConnection: DockerConnection, pullSecretName: string) {
    const funcDeployCommand = commandHelper.getFuncDeployCommand(dockerConnection, secretName, appName, namespace, dockerHubNamespace, pullSecretName, args);
    commandHelper.execCommand(funcDeployCommand, { cwd: funcRootDir } as tr.IExecOptions);
}

function annotateKubernetesResources(commandHelper: CommandHelper, resourcesYaml: string) {
    const funcKubernetesTemplatesPath = FileHelper.getFuncKubernetesYamlPath();
    FileHelper.writeContentToFile(funcKubernetesTemplatesPath, resourcesYaml);
    const kubectl = new Kubectl(commandHelper.kubectlPath, namespace);
    const annotateResults = kubectl.annotateFiles(funcKubernetesTemplatesPath, KubernetesConstants.pipelineAnnotations, true);
    CommonUtils.checkForErrors([annotateResults]);
}

async function checkManifestStability(commandHelper: CommandHelper, resources: Resource[]) {
    const kubectl = new Kubectl(commandHelper.kubectlPath, namespace);
    await KubernetesManifestUtility.checkManifestStability(kubectl, resources);
}

function getKubernetesResourcesYaml(commandHelper: CommandHelper, dockerConnection, pullSecretName: string): string {
    let resourcesYaml = null;
    const argsWithDryRun = args ? args.concat(' --dry-run') : '--dry-run';
    const funcDeployDryRunCommand = commandHelper.getFuncDeployCommand(dockerConnection, secretName, appName, namespace, dockerHubNamespace, pullSecretName, argsWithDryRun);
    const result: tr.IExecSyncResult = commandHelper.execCommand(funcDeployDryRunCommand, { cwd: funcRootDir } as tr.IExecOptions);
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