"use strict";

import fs = require("fs");
import path = require('path');
import tl = require('vsts-task-lib/task');
import yaml = require('js-yaml');
import * as canaryDeploymentHelper from '../utils/CanaryDeploymentHelper';
import * as KubernetesObjectUtility from '../utils/KubernetesObjectUtility';
import * as constants from '../models/constants';
import * as TaskInputParameters from '../models/TaskInputParameters';
import * as models from '../models/constants';
import * as fileHelper from "../utils/FileHelper";
import * as utils from "../utils/utilities";
import { IExecSyncResult } from 'vsts-task-lib/toolrunner';
import { Kubectl, Resource } from "kubernetes-common/kubectl-object-model";


export function deploy(kubectl: Kubectl, manifestFilesPath: string, deploymentStrategy: string) {

    // get manifest files
    var inputManifestFiles: string[] = getManifestFiles(manifestFilesPath);

    // artifact substitution
    inputManifestFiles = updateContainerImagesInManifestFiles(inputManifestFiles, TaskInputParameters.containers);

    // imagePullSecrets addition
    inputManifestFiles = updateImagePullSecretsInManifestFiles(inputManifestFiles, TaskInputParameters.imagePullSecrets);

    // deployment
    var deployedManifestFiles = deployManifests(inputManifestFiles, kubectl, isCanaryDeploymentStrategy(deploymentStrategy));

    // check manifest stability
    let resourceTypes: Resource[] = KubernetesObjectUtility.getResources(deployedManifestFiles, models.recognizedWorkloadTypes);
    checkManifestStability(kubectl, resourceTypes);

    // annotate resources
    annotateResources(deployedManifestFiles, kubectl, resourceTypes);
}

function getManifestFiles(manifestFilesPath: string): string[] {
    var files: string[] = utils.getManifestFiles(manifestFilesPath);

    if (files == null || files.length == 0) {
        throw (tl.loc("ManifestFileNotFound"));
    }

    return files;
}

function deployManifests(files: string[], kubectl: Kubectl, isCanaryDeploymentStrategy: boolean): string[] {
    let result;
    if (isCanaryDeploymentStrategy) {
        var canaryDeploymentOutput = canaryDeploymentHelper.deployCanary(kubectl, files);
        result = canaryDeploymentOutput.result;
        files = canaryDeploymentOutput.newFilePaths;
    } else {
        result = kubectl.apply(files);
    }
    utils.checkForErrors([result]);
    return files;
}

function checkManifestStability(kubectl: Kubectl, resourceTypes: Resource[]) {
    let rolloutStatusResults = [];
    resourceTypes.forEach(resource => {
        if (models.recognizedWorkloadTypesWithRolloutStatus.indexOf(resource.type.toLowerCase()) >= 0) {
            rolloutStatusResults.push(kubectl.checkRolloutStatus(resource.type, resource.name));
        }
    });
    utils.checkForErrors(rolloutStatusResults);
}

function annotateResources(files: string[], kubectl: Kubectl, resourceTypes: Resource[]) {
    let annotateResults: IExecSyncResult[] = [];
    var allPods = JSON.parse((kubectl.getAllPods()).stdout);
    annotateResults.push(kubectl.annotateFiles(files, constants.pipelineAnnotations, true));
    resourceTypes.forEach(resource => {
        if (resource.type.toUpperCase() != models.KubernetesWorkload.Pod.toUpperCase()) {
            utils.annotateChildPods(kubectl, resource.type, resource.name, allPods)
                .forEach(execResult => annotateResults.push(execResult));
        }
    });
    utils.checkForErrors(annotateResults, true);
}

function updateContainerImagesInManifestFiles(filePaths: string[], containers: string[]): string[] {
    if (!!containers && containers.length > 0) {
        let newFilePaths = [];
        const tempDirectory = fileHelper.getTempDirectory();
        filePaths.forEach((filePath: string) => {
            var contents = fs.readFileSync(filePath).toString();
            containers.forEach((container: string) => {
                let imageName = container.split(":")[0];
                if (imageName.indexOf("@") > 0)
                    imageName = imageName.split("@")[0];
                if (contents.indexOf(imageName) > 0) {
                    contents = utils.substituteImageNameInSpecFile(contents, imageName, container);
                }
            });

            let fileName = path.join(tempDirectory, path.basename(filePath));
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
        var newObjectsList = [];
        filePaths.forEach((filePath: string) => {
            var fileContents = fs.readFileSync(filePath);
            yaml.safeLoadAll(fileContents, function (inputObject) {
                if (!!inputObject && !!inputObject.kind) {
                    var kind = inputObject.kind;
                    if (KubernetesObjectUtility.isDeploymentEntity(kind)) {
                        KubernetesObjectUtility.updateImagePullSecrets(inputObject, imagePullSecrets, false);
                    }
                    newObjectsList.push(inputObject);
                }
            });
        });
        tl.debug("New K8s objects after addin imagePullSecrets are :"+JSON.stringify(newObjectsList));
        var newFilePaths = fileHelper.writeObjectsToFile(newObjectsList);
        return newFilePaths;
    }
    return filePaths;
}

function isCanaryDeploymentStrategy(deploymentStrategy: string): boolean {
    return deploymentStrategy != null && deploymentStrategy.toUpperCase() == canaryDeploymentHelper.CANARY_DEPLOYMENT_STRATEGY.toUpperCase();
}
