'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as yaml from 'js-yaml';
import * as canaryDeploymentHelper from '../utils/CanaryDeploymentHelper';
import * as KubernetesObjectUtility from '../utils/KubernetesObjectUtility';
import * as constants from 'azure-pipelines-tasks-kubernetes-common/kubernetesconstants';
import * as TaskInputParameters from '../models/TaskInputParameters';
import * as models from 'azure-pipelines-tasks-kubernetes-common/kubernetesconstants';
import * as fileHelper from '../utils/FileHelper';
import * as utils from '../utils/utilities';
import * as KubernetesManifestUtility from 'azure-pipelines-tasks-kubernetes-common/kubernetesmanifestutility';
import * as KubernetesConstants from 'azure-pipelines-tasks-kubernetes-common/kubernetesconstants';
import { IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';
import { Kubectl, Resource } from 'azure-pipelines-tasks-kubernetes-common/kubectl-object-model';
import { isEqual, StringComparer } from './StringComparison';
import { getDeploymentMetadata, getPublishDeploymentRequestUrl, isDeploymentEntity, getManifestUrls } from 'azure-pipelines-tasks-kubernetes-common/image-metadata-helper';
import { WebRequest, sendRequest } from 'azure-pipelines-tasks-utility-common/restutilities';
import { deployPodCanary } from './PodCanaryDeploymentHelper';
import { deploySMICanary } from './SMICanaryDeploymentHelper';

export async function deploy(kubectl: Kubectl, manifestFilePaths: string[], deploymentStrategy: string) {

    // get manifest files
    let inputManifestFiles: string[] = getManifestFiles(manifestFilePaths);

    // imagePullSecrets addition & artifact substitution
    inputManifestFiles = updateResourceObjects(inputManifestFiles, TaskInputParameters.imagePullSecrets, TaskInputParameters.containers);

    // deployment
    const deployedManifestFiles = deployManifests(inputManifestFiles, kubectl, isCanaryDeploymentStrategy(deploymentStrategy));

    // check manifest stability
    const resourceTypes: Resource[] = KubernetesObjectUtility.getResources(deployedManifestFiles, models.deploymentTypes.concat([KubernetesConstants.DiscoveryAndLoadBalancerResource.service]));
    await checkManifestStability(kubectl, resourceTypes);

    // print ingress resources
    const ingressResources: Resource[] = KubernetesObjectUtility.getResources(deployedManifestFiles, [KubernetesConstants.DiscoveryAndLoadBalancerResource.ingress]);
    ingressResources.forEach(ingressResource => {
        kubectl.getResource(KubernetesConstants.DiscoveryAndLoadBalancerResource.ingress, ingressResource.name);
    });

    // annotate resources
    let allPods: any;
    try {
        allPods = JSON.parse((kubectl.getAllPods()).stdout);
    } catch (e) {
        tl.debug("Unable to parse pods; Error: " + e);
    }

    annotateResources(deployedManifestFiles, kubectl, resourceTypes, allPods);

    // Capture and push deployment metadata only if deployment strategy is not specified (because for Canary/SMI we do not replace actual deployment objects)
    if (!isCanaryDeploymentStrategy(deploymentStrategy)) {
        try {
            const clusterInfo = kubectl.getClusterInfo().stdout;
            captureAndPushDeploymentMetadata(inputManifestFiles, allPods, deploymentStrategy, clusterInfo, manifestFilePaths);
        } catch (e) {
            tl.warning("Capturing deployment metadata failed with error: " + e);
        }
    }
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
        let canaryDeploymentOutput: any;
        if (canaryDeploymentHelper.isSMICanaryStrategy()) {
            canaryDeploymentOutput = deploySMICanary(kubectl, files);
        } else {
            canaryDeploymentOutput = deployPodCanary(kubectl, files);
        }
        result = canaryDeploymentOutput.result;
        files = canaryDeploymentOutput.newFilePaths;
    } else {
        if (canaryDeploymentHelper.isSMICanaryStrategy()) {
            const updatedManifests = appendStableVersionLabelToResource(files, kubectl);
            result = kubectl.apply(updatedManifests);
        } else {
            result = kubectl.apply(files);
        }
    }
    utils.checkForErrors([result]);
    return files;
}

function appendStableVersionLabelToResource(files: string[], kubectl: Kubectl): string[] {
    const manifestFiles = [];
    const newObjectsList = [];

    files.forEach((filePath: string) => {
        const fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {
            const kind = inputObject.kind;
            if (KubernetesObjectUtility.isDeploymentEntity(kind)) {
                const updatedObject = canaryDeploymentHelper.markResourceAsStable(inputObject);
                newObjectsList.push(updatedObject);
            } else {
                manifestFiles.push(filePath);
            }
        });
    });

    const updatedManifestFiles = fileHelper.writeObjectsToFile(newObjectsList);
    manifestFiles.push(...updatedManifestFiles);
    return manifestFiles;
}

async function checkManifestStability(kubectl: Kubectl, resources: Resource[]): Promise<void> {
    await KubernetesManifestUtility.checkManifestStability(kubectl, resources, TaskInputParameters.rolloutStatusTimeout);

}

function annotateResources(files: string[], kubectl: Kubectl, resourceTypes: Resource[], allPods: any) {
    const annotateResults: IExecSyncResult[] = [];
    annotateResults.push(kubectl.annotateFiles(files, constants.pipelineAnnotations, true));
    resourceTypes.forEach(resource => {
        if (resource.type.toUpperCase() !== models.KubernetesWorkload.pod.toUpperCase()) {
            utils.annotateChildPods(kubectl, resource.type, resource.name, allPods)
                .forEach(execResult => annotateResults.push(execResult));
        }
    });
    utils.checkForErrors(annotateResults, true);
}

export function updateResourceObjects(filePaths: string[], imagePullSecrets: string[], containers: string[]): string[] {
    const newObjectsList = [];
    const updateResourceObject = (inputObject) => {
        if (!!imagePullSecrets && imagePullSecrets.length > 0) {
            KubernetesObjectUtility.updateImagePullSecrets(inputObject, imagePullSecrets, false);
        }
        if (!!containers && containers.length > 0) {
            KubernetesObjectUtility.updateImageDetails(inputObject, containers);
        }
    }
    filePaths.forEach((filePath: string) => {
        const fileContents = fs.readFileSync(filePath).toString();
        yaml.safeLoadAll(fileContents, function (inputObject: any) {
            if (inputObject && inputObject.kind) {
                const kind = inputObject.kind;
                if (KubernetesObjectUtility.isWorkloadEntity(kind)) {
                    updateResourceObject(inputObject);
                }
                else if (isEqual(kind, 'list', StringComparer.OrdinalIgnoreCase)) {
                    let items = inputObject.items;
                    if (items.length > 0) {
                        items.forEach((item) => updateResourceObject(item));
                    }
                }
                newObjectsList.push(inputObject);
            }
        });
    });
    tl.debug('New K8s objects after addin imagePullSecrets are :' + JSON.stringify(newObjectsList));
    const newFilePaths = fileHelper.writeObjectsToFile(newObjectsList);
    return newFilePaths;
}

function captureAndPushDeploymentMetadata(filePaths: string[], allPods: any, deploymentStrategy: string, clusterInfo: any, manifestFilePaths: string[]) {
    const requestUrl = getPublishDeploymentRequestUrl();
    let metadata = {};
    filePaths.forEach((filePath: string) => {
        const fileContents = fs.readFileSync(filePath).toString();
        yaml.safeLoadAll(fileContents, function (inputObject: any) {
            if (!!inputObject && inputObject.kind && isDeploymentEntity(inputObject.kind)) {
                metadata = getDeploymentMetadata(inputObject, allPods, deploymentStrategy, clusterInfo, getManifestUrls(manifestFilePaths));
                pushDeploymentDataToEvidenceStore(JSON.stringify(metadata), requestUrl).then((result) => {
                    tl.debug("DeploymentDetailsApiResponse: " + JSON.stringify(result));
                }, (error) => {
                    tl.warning("publishToImageMetadataStore failed with error: " + error);
                });
            }
        });
    });
}

async function pushDeploymentDataToEvidenceStore(requestBody: string, requestUrl: string): Promise<any> {
    const request = new WebRequest();
    const accessToken: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
    request.uri = requestUrl;
    request.method = 'POST';
    request.body = requestBody;
    request.headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + accessToken
    };

    tl.debug("requestUrl: " + requestUrl);
    tl.debug("requestBody: " + requestBody);

    try {
        tl.debug("Sending request for pushing deployment data to Image meta data store");
        const response = await sendRequest(request);
        return response;
    }
    catch (error) {
        tl.debug("Unable to push to deployment details to Artifact Store, Error: " + error);
    }

    return Promise.resolve();
}

function isCanaryDeploymentStrategy(deploymentStrategy: string): boolean {
    return deploymentStrategy != null && deploymentStrategy.toUpperCase() === canaryDeploymentHelper.CANARY_DEPLOYMENT_STRATEGY.toUpperCase();
}
