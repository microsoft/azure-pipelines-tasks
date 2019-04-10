"use strict";
import { Kubectl } from "kubernetes-common/kubectl-object-model";
import * as helper from './KubernetesObjectUtility';
import { KubernetesWorkload } from "../models/constants"
import * as utils from "./utilities";
import tl = require('vsts-task-lib/task');
import fs = require("fs");
import yaml = require('js-yaml');
import * as TaskInputParameters from '../models/TaskInputParameters';
import * as fileHelper from "../utils/FileHelper";

export const CANARY_DEPLOYMENT_STRATEGY = "CANARY";
const BASELINE_SUFFIX = "-baseline";
const BASELINE_LABEL_VALUE = "baseline";
const CANARY_SUFFIX = "-canary";
const CANARY_LABEL_VALUE = "canary";
const CANARY_VERSION_LABEL = "azure-pipelines/version";

export function deleteCanaryDeployment(kubectl: Kubectl, manifestFilesPath: string) {

    // get manifest files
    var inputManifestFiles: string[] = utils.getManifestFiles(manifestFilesPath);

    if (inputManifestFiles == null || inputManifestFiles.length == 0) {
        throw (tl.loc("ManifestFileNotFound"));
    }

    // create delete cmd prefix
    let argsPrefix: string;
    argsPrefix = createCanaryObjectsArgumentString(inputManifestFiles);

    // append delete cmd args as suffix (if present)
    let args = utils.getDeleteCmdArgs(argsPrefix, TaskInputParameters.args);
    tl.debug("Delete cmd args : " + args);

    if (!!args && args.length > 0) {
        // run kubectl delete cmd
        var result = kubectl.delete(args);
        utils.checkForErrors([result]);
    }
}

export function deployCanary(kubectl: Kubectl, filePaths: string[]) {
    var newObjectsList = [];
    var percentage = parseInt(TaskInputParameters.canaryPercentage);

    filePaths.forEach((filePath: string) => {
        var fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {

            var name = inputObject.metadata.name;
            var kind = inputObject.kind;
            if (helper.isDeploymentEntity(kind)) {
                var existing_canary_object = fetchCanaryResource(kubectl, kind, name);

                if (!!existing_canary_object) {
                    throw (tl.loc("CanaryDeploymentAlreadyExistErrorMessage"));
                }

                tl.debug("Calculating replica count for canary");
                var canaryReplicaCount = calculateReplicaCountForCanary(inputObject, percentage);
                tl.debug("Replica count is " + canaryReplicaCount);
                // Get stable object
                tl.debug("Querying stable object");
                var stable_object = fetchResource(kubectl, kind, name);
                if (!stable_object) {
                    tl.debug("Stable object not found. Creating only canary object");
                    // If stable object not found, create canary deployment.
                    var newCanaryObject = getNewCanaryResource(inputObject, canaryReplicaCount);
                    tl.debug("New canary object is: " + JSON.stringify(newCanaryObject));
                    newObjectsList.push(newCanaryObject);
                } else {
                    tl.debug("Stable object found. Creating canary and baseline objects");
                    // If canary object not found, create canary and baseline object.
                    var newCanaryObject = getNewCanaryResource(inputObject, canaryReplicaCount);
                    var newBaselineObject = getNewBaselineResource(stable_object, canaryReplicaCount);
                    tl.debug("New canary object is: " + JSON.stringify(newCanaryObject));
                    tl.debug("New baseline object is: " + JSON.stringify(newBaselineObject));
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

export function isCanaryDeploymentStrategy() {
    var deploymentStrategy = TaskInputParameters.deploymentStrategy;
    return deploymentStrategy && deploymentStrategy.toUpperCase() === CANARY_DEPLOYMENT_STRATEGY;
}

function calculateReplicaCountForCanary(inputObject: any, percentage: number) {
    var inputReplicaCount = helper.getReplicaCount(inputObject);
    return Math.round((inputReplicaCount * percentage) / 100);
}

function getNewBaselineResource(stableObject: any, replicas: number): object {
    return getNewCanaryObject(stableObject, replicas, BASELINE_LABEL_VALUE);
}

function getNewCanaryResource(inputObject: any, replicas: number): object {
    return getNewCanaryObject(inputObject, replicas, CANARY_LABEL_VALUE);
}

function getCanaryResourceName(name: string) {
    return name + CANARY_SUFFIX;
}

function getBaselineResourceName(name: string) {
    return name + BASELINE_SUFFIX;
}

function fetchResource(kubectl: Kubectl, kind: string, name: string): object {
    var result = kubectl.getResource(kind, name);

    if (result == null || !!result.stderr) {
        return null;
    }

    if (!!result.stdout) {
        try {
            var resource = JSON.parse(result.stdout);
            UnsetsClusterSpecficDetails(resource);
            return resource;
        } catch (ex) {
            tl.debug("Exception occurred while Parsing " + resource + " in Json object");
            return null;
        }
    }
    return null;
}

function UnsetsClusterSpecficDetails(resource: any) {

    if (resource == null) {
        return;
    }

    // Unsets the cluster specific details in the object
    if (!!resource) {
        var metadata = resource.metadata;
        var status = resource.status;

        if (!!metadata) {
            var newMetadata = {
                "annotations": metadata.annotations,
                "labels": metadata.labels,
                "name": metadata.name
            };

            resource.metadata = newMetadata;
        }

        if (!!status) {
            resource.status = {};
        }
    }
}

function fetchCanaryResource(kubectl: Kubectl, kind: string, name: string): object {
    return fetchResource(kubectl, kind, getCanaryResourceName(name));
}

function getNewCanaryObject(inputObject: any, replicas: number, type: string): object {
    var newObject = JSON.parse(JSON.stringify(inputObject));

    // Updating name
    newObject.metadata.name = type === CANARY_LABEL_VALUE ?
        getCanaryResourceName(inputObject.metadata.name) :
        getBaselineResourceName(inputObject.metadata.name);

    // Adding labels and annotations.
    addCanaryLabelsAndAnnotations(newObject, type);

    // Updating no. of replicas
    if (!utils.isEqual(newObject.kind, KubernetesWorkload.Pod, utils.StringComparer.OrdinalIgnoreCase) &&
        !utils.isEqual(newObject.kind, KubernetesWorkload.DaemonSet, utils.StringComparer.OrdinalIgnoreCase)) {
        newObject.spec.replicas = replicas;
    }

    return newObject;
}

function addCanaryLabelsAndAnnotations(inputObject: any, type: string) {
    var newLabels = new Map<string, string>();
    newLabels[CANARY_VERSION_LABEL] = type;

    helper.updateObjectLabels(inputObject, newLabels, false);
    helper.updateObjectAnnotations(inputObject, newLabels, false);
    helper.updateSelectorLabels(inputObject, newLabels, false);
    helper.updateSpecLabels(inputObject, newLabels, false);
}

function createCanaryObjectsArgumentString(files: string[]) {
    let kindList = new Set();
    let nameList = new Set();

    files.forEach((filePath: string) => {
        var fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {
            var name = inputObject.metadata.name;
            var kind = inputObject.kind;
            if (helper.isDeploymentEntity(kind)) {
                var canaryObjectName = getCanaryResourceName(name);
                var baselineObjectName = getBaselineResourceName(name);
                kindList.add(kind);
                nameList.add(canaryObjectName);
                nameList.add(baselineObjectName);
            }
        });
    });

    if (kindList.size == 0) {
        tl.debug("CanaryDeploymentHelper : No deployment objects found");
    }

    var args = utils.createKubectlArgs(kindList, nameList);
    return args;
}