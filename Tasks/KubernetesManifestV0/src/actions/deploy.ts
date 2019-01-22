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
import { Kubectl, Resource } from "utility-common/kubectl-object-model";

const CANARY_DEPLOYMENT_STRATEGY = "CANARY";

export async function deploy() {
    var inputManifestFiles: string[] = getManifestFiles();
    let kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace);
    var deployedManifestFiles = deployManifests(inputManifestFiles, kubectl);
    let resourceTypes: Resource[] = KubernetesObjectUtility.getResources(deployedManifestFiles, models.recognizedWorkloadTypes);
    checkManifestStability(kubectl, resourceTypes);
    annotateResources(deployedManifestFiles, kubectl, resourceTypes);
}

function getManifestFiles(): string[] {
    var files: string[] = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(), TaskInputParameters.manifests);

    if (files.length == 0) {
        throw (tl.loc("ManifestFileNotFound"));
    }

    files = updateContainerImagesInConfigFiles(files, TaskInputParameters.containers);
    return files;
}

function deployManifests(files: string[], kubectl: Kubectl): string[] {
    var deploymentStrategy = TaskInputParameters.deploymentStrategy;
    let result;
    if (deploymentStrategy && deploymentStrategy.toUpperCase() === CANARY_DEPLOYMENT_STRATEGY) {
        var canaryDeploymentOutput = canaryDeployment(files, kubectl);
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
        if (models.recognizedWorkloadTypesWithRolloutStatus.indexOf(resource.type.toLowerCase()) == -1) {
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

function canaryDeployment(filePaths: string[], kubectl: Kubectl) {
    var newObjectsList = [];
    var percentage = parseInt(TaskInputParameters.canaryPercentage);

    filePaths.forEach((filePath: string) => {
        var fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {

            var name = inputObject.metadata.name;
            var kind = inputObject.kind;
            if (canaryDeploymentHelper.isDeploymentEntity(kind)) {
                var existing_canary_object = canaryDeploymentHelper.fetchCanaryResource(kubectl, kind, name);

                if (!!existing_canary_object) {
                    throw (tl.loc("CanaryDeploymentAlreadyExistErrorMessage"));
                }

                var canaryReplicaCount = canaryDeploymentHelper.calculateReplicaCountForCanary(inputObject, percentage);
                // Get stable object
                var stable_object = canaryDeploymentHelper.fetchResource(kubectl, kind, name);
                if (!stable_object) {
                    // If stable object not found, create canary deployment.
                    var newCanaryObject = canaryDeploymentHelper.getNewCanaryResource(inputObject, canaryReplicaCount);
                    newObjectsList.push(newCanaryObject);
                } else {
                    // If canary object not found, create canary and baseline object.
                    var newCanaryObject = canaryDeploymentHelper.getNewCanaryResource(inputObject, canaryReplicaCount);
                    var newBaselineObject = canaryDeploymentHelper.getNewBaselineResource(stable_object, canaryReplicaCount);
                    newObjectsList.push(newCanaryObject);
                    newObjectsList.push(newBaselineObject);
                }
            } else {
                // Updating non deployment entity as it is.
                newObjectsList.push(inputObject);
            }
        });
    });

    var manifestFiles = fileHelper.writeObjectsToFile(newObjectsList);
    var result = kubectl.apply(manifestFiles);
    return { "result": result, "newFilePaths": manifestFiles };
}

function updateContainerImagesInConfigFiles(filePaths: string[], containers): string[] {
    if (containers != []) {
        let newFilePaths = [];
        const tempDirectory = fileHelper.getTempDirectory();
        filePaths.forEach((filePath: string) => {
            var contents = fs.readFileSync(filePath).toString();
            containers.forEach((container: string) => {
                let imageName = container.split(":")[0] + ":";
                if (contents.indexOf(imageName) > 0) {
                    contents = utils.replaceAllTokens(contents, imageName, container);
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
