"use strict";
import { Kubectl } from "utility-common/kubectl-object-model";
import * as helper from './KubernetesObjectUtility';
import { KubernetesWorkload, recognizedWorkloadTypes } from "../models/constants"
import * as utils from "./utilities";
import tl = require('vsts-task-lib/task');
import fs = require("fs");
import yaml = require('js-yaml');
import * as TaskInputParameters from '../models/TaskInputParameters';
import * as fileHelper from "../utils/FileHelper";

const CANARY_DEPLOYMENT_STRATEGY = "CANARY";
const BASELINE_SUFFIX = "-baseline";
const BASELINE_LABEL_VALUE = "baseline";
const CANARY_SUFFIX = "-canary";
const CANARY_LABEL_VALUE = "canary";
const CANARY_VERSION_LABEL = "azure-pipelines/version";

export function calculateReplicaCountForCanary(inputObject: any, percentage: number) {
    var inputReplicaCount = helper.getReplicaCount(inputObject);
    return Math.round((inputReplicaCount * percentage) / 100);
}

export function isDeploymentEntity(kind: string): boolean {
    if (!kind) {
        throw (tl.loc("ResourceKindNotDefined"));
    }

    return recognizedWorkloadTypes.some(function (elem) {
        return utils.isEqual(elem, kind, utils.StringComparer.OrdinalIgnoreCase);
    });
}

export function getNewBaselineResource(stableObject: any, replicas: number): object {
    return getNewCanaryObject(stableObject, replicas, BASELINE_LABEL_VALUE);
}

export function getNewCanaryResource(inputObject: any, replicas: number): object {
    return getNewCanaryObject(inputObject, replicas, CANARY_LABEL_VALUE);
}
export function getCanaryResourceName(name: string) {
    return name + CANARY_SUFFIX;
}

export function getBaselineResourceName(name: string) {
    return name + BASELINE_SUFFIX;
}

export function fetchResource(kubectl: Kubectl, kind: string, name: string): object {
    var result = kubectl.getResource(kind, name);
    return result.stderr ? null : JSON.parse(result.stdout);
}

export function fetchCanaryResource(kubectl: Kubectl, kind: string, name: string): object {
    return fetchResource(kubectl, kind, getCanaryResourceName(name));
}

export function deleteCanaryDeployment(kubectl: Kubectl, manifestFilesPath: string) {

    // get manifest files
    var inputManifestFiles: string[] = utils.getManifestFiles(manifestFilesPath);

    if (inputManifestFiles == null || inputManifestFiles.length == 0) 
    {
        throw (tl.loc("ManifestFileNotFound"));
    }

    // create delete cmd prefix
    let argsPrefix: string;
    argsPrefix = createCanaryObjectsArgumentString(inputManifestFiles);

    // append delete cmd args as suffix (if present)
    let args = utils.getDeleteCmdArgs(argsPrefix, TaskInputParameters.args);
    tl.debug("Delete cmd args : "+args);
    
    // run kubectl delete cmd
    var result = kubectl.delete(args);
    utils.checkForErrors([result]);
}

export function deployCanary(kubectl: Kubectl, filePaths: string[]) {
    var newObjectsList = [];
    var percentage = parseInt(TaskInputParameters.canaryPercentage);

    filePaths.forEach((filePath: string) => {
        var fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {

            var name = inputObject.metadata.name;
            var kind = inputObject.kind;
            if (isDeploymentEntity(kind)) {
                var existing_canary_object = fetchCanaryResource(kubectl, kind, name);

                if (!!existing_canary_object) {
                    throw (tl.loc("CanaryDeploymentAlreadyExistErrorMessage"));
                }

                var canaryReplicaCount = calculateReplicaCountForCanary(inputObject, percentage);
                // Get stable object
                var stable_object = fetchResource(kubectl, kind, name);
                if (!stable_object) {
                    // If stable object not found, create canary deployment.
                    var newCanaryObject = getNewCanaryResource(inputObject, canaryReplicaCount);
                    newObjectsList.push(newCanaryObject);
                } else {
                    // If canary object not found, create canary and baseline object.
                    var newCanaryObject = getNewCanaryResource(inputObject, canaryReplicaCount);
                    var newBaselineObject = getNewBaselineResource(stable_object, canaryReplicaCount);
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
            if (isDeploymentEntity(kind)) {
                var canaryObjectName = getCanaryResourceName(name);
                var baselineObjectName = getBaselineResourceName(name);
                kindList.add(kind);
                nameList.add(canaryObjectName);
                nameList.add(baselineObjectName);
            }
        });
    });

    var args = utils.createKubectlArgs(kindList, nameList);
    return args;
}