'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as yaml from 'js-yaml';
import * as canaryDeploymentHelper from '../utils/CanaryDeploymentHelper';
import * as KubernetesObjectUtility from '../utils/KubernetesObjectUtility';
import * as constants from '../models/constants';
import * as TaskInputParameters from '../models/TaskInputParameters';
import * as models from '../models/constants';
import * as fileHelper from '../utils/FileHelper';
import * as utils from '../utils/utilities';
import { IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';
import { Kubectl, Resource } from 'kubernetes-common-v2/kubectl-object-model';
import { isEqual, StringComparer } from './StringComparison';

export async function deploy(kubectl: Kubectl, manifestFilePaths: string[], deploymentStrategy: string) {

    // get manifest files
    let inputManifestFiles: string[] = getManifestFiles(manifestFilePaths);

    // artifact substitution
    inputManifestFiles = updateContainerImagesInManifestFiles(inputManifestFiles, TaskInputParameters.containers);

    // imagePullSecrets addition
    inputManifestFiles = updateImagePullSecretsInManifestFiles(inputManifestFiles, TaskInputParameters.imagePullSecrets);

    // deployment
    const deployedManifestFiles = deployManifests(inputManifestFiles, kubectl, isCanaryDeploymentStrategy(deploymentStrategy));

    // check manifest stability
    const resourceTypes: Resource[] = KubernetesObjectUtility.getResources(deployedManifestFiles, models.deploymentTypes);
    await checkManifestStability(kubectl, resourceTypes);

    // annotate resources
    annotateResources(deployedManifestFiles, kubectl, resourceTypes);
}

function getManifestFiles(manifestFilePaths: string[]): string[] {
    const files: string[] = utils.getManifestFiles(manifestFilePaths);

    if (files == null || files.length === 0) {
        throw (tl.loc('ManifestFileNotFound', manifestFilePaths));
    }

    return files;
}

function deployManifests(files: string[], kubectl: Kubectl, isCanaryDeploymentStrategy: boolean): string[] {
    let result;
    if (isCanaryDeploymentStrategy) {
        const canaryDeploymentOutput = canaryDeploymentHelper.deployCanary(kubectl, files);
        result = canaryDeploymentOutput.result;
        files = canaryDeploymentOutput.newFilePaths;
    } else {
        result = kubectl.apply(files);
    }
    utils.checkForErrors([result]);
    return files;
}

async function checkManifestStability(kubectl: Kubectl, resources: Resource[]): Promise<void> {
    const rolloutStatusResults = [];
    const numberOfResources = resources.length;
    for (let i = 0; i< numberOfResources; i++) {
        const resource = resources[i];
        if (models.workloadTypesWithRolloutStatus.indexOf(resource.type.toLowerCase()) >= 0) {
            rolloutStatusResults.push(kubectl.checkRolloutStatus(resource.type, resource.name));
        }
        if (isEqual(resource.type, constants.KubernetesWorkload.pod, StringComparer.OrdinalIgnoreCase)) {
            try {
                await checkPodStatus(kubectl, resource.name);
            } catch (ex) {
                tl.warning(tl.loc('CouldNotDeterminePodStatus', JSON.stringify(ex)));
            }
        }
    }
    utils.checkForErrors(rolloutStatusResults);
}

function annotateResources(files: string[], kubectl: Kubectl, resourceTypes: Resource[]) {
    const annotateResults: IExecSyncResult[] = [];
    const allPods = JSON.parse((kubectl.getAllPods()).stdout);
    annotateResults.push(kubectl.annotateFiles(files, constants.pipelineAnnotations, true));
    resourceTypes.forEach(resource => {
        if (resource.type.toUpperCase() !== models.KubernetesWorkload.pod.toUpperCase()) {
            utils.annotateChildPods(kubectl, resource.type, resource.name, allPods)
                .forEach(execResult => annotateResults.push(execResult));
        }
    });
    utils.checkForErrors(annotateResults, true);
}

function updateContainerImagesInManifestFiles(filePaths: string[], containers: string[]): string[] {
    if (!!containers && containers.length > 0) {
        const newFilePaths = [];
        const tempDirectory = fileHelper.getTempDirectory();
        filePaths.forEach((filePath: string) => {
            let contents = fs.readFileSync(filePath).toString();
            containers.forEach((container: string) => {
                let imageName = container.split(':')[0];
                if (imageName.indexOf('@') > 0) {
                    imageName = imageName.split('@')[0];
                }
                if (contents.indexOf(imageName) > 0) {
                    contents = utils.substituteImageNameInSpecFile(contents, imageName, container);
                }
            });

            const fileName = path.join(tempDirectory, path.basename(filePath));
            fs.writeFileSync(
                path.join(fileName),
                contents
            );
            newFilePaths.push(fileName);
        });

        return newFilePaths;
    }

    return filePaths;
}

function updateImagePullSecretsInManifestFiles(filePaths: string[], imagePullSecrets: string[]): string[] {
    if (!!imagePullSecrets && imagePullSecrets.length > 0) {
        const newObjectsList = [];
        filePaths.forEach((filePath: string) => {
            const fileContents = fs.readFileSync(filePath).toString();
            yaml.safeLoadAll(fileContents, function (inputObject: any) {
                if (!!inputObject && !!inputObject.kind) {
                    const kind = inputObject.kind;
                    if (KubernetesObjectUtility.isWorkloadEntity(kind)) {
                        KubernetesObjectUtility.updateImagePullSecrets(inputObject, imagePullSecrets, false);
                    }
                    newObjectsList.push(inputObject);
                }
            });
        });
        tl.debug('New K8s objects after addin imagePullSecrets are :' + JSON.stringify(newObjectsList));
        const newFilePaths = fileHelper.writeObjectsToFile(newObjectsList);
        return newFilePaths;
    }
    return filePaths;
}

function isCanaryDeploymentStrategy(deploymentStrategy: string): boolean {
    return deploymentStrategy != null && deploymentStrategy.toUpperCase() === canaryDeploymentHelper.CANARY_DEPLOYMENT_STRATEGY.toUpperCase();
}

async function checkPodStatus(kubectl: Kubectl, podName: string): Promise<void> {
    const sleepTimeout = 10 * 1000; // 10 seconds
    const iterations = 60; // 60 * 10 seconds timeout = 10 minutes max timeout
    let podStatus;
    for (let i = 0; i < iterations; i++) {
        await sleep(sleepTimeout);
        tl.debug(`Polling for pod status: ${podName}`);
        podStatus = getPodStatus(kubectl, podName);
        if (podStatus.phase && podStatus.phase !== 'Pending' && podStatus.phase !== 'Unknown') {
            break;
        }
    }
    podStatus = getPodStatus(kubectl, podName);
    switch (podStatus.phase) {
        case 'Succeeded':
        case 'Running':
            if (isPodReady(podStatus)) {
                console.log(`pod/${podName} is successfully rolled out`);
            }
            break;
        case 'Pending':
            if (!isPodReady(podStatus)) {
                tl.warning(`pod/${podName} rollout status check timedout`);
            }
            break;
        case 'Failed':
            tl.error(`pod/${podName} rollout failed`);
            break;
        default:
            tl.warning(`pod/${podName} rollout status: ${podStatus.phase}`);
    }
}

function getPodStatus(kubectl: Kubectl, podName: string): any {
    const podResult = kubectl.getResource('pod', podName);
    utils.checkForErrors([podResult]);
    const podStatus = JSON.parse(podResult.stdout).status;
    tl.debug(`Pod Status: ${JSON.stringify(podStatus)}`);
    return podStatus;
}

function isPodReady(podStatus: any): boolean {
    let allContainersAreReady = true;
    podStatus.containerStatuses.forEach(container => {
        if (container.ready === false) {
            console.log(`'${container.name}' status: ${JSON.stringify(container.state)}`);
            allContainersAreReady = false;
        }
    });
    if (!allContainersAreReady) {
        tl.warning(tl.loc('AllContainersNotInReadyState'));
    }
    return allContainersAreReady;
}

function sleep(timeout: number) {
    return new Promise(resolve => setTimeout(resolve, timeout));
}