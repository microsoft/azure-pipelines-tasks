'use strict';

import { Kubectl } from 'kubernetes-common-v2/kubectl-object-model';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as util from 'util';

import * as TaskInputParameters from '../models/TaskInputParameters';
import * as fileHelper from './FileHelper';
import * as helper from './KubernetesObjectUtility';
import * as utils from './utilities';
import * as canaryDeploymentHelper from './CanaryDeploymentHelper';

const TRAFFIC_SPLIT_OBJECT_NAME_SUFFIX = '-azure-pipelines-rollout';
const TRAFFIC_SPLIT_OBJECT = 'TrafficSplit';

export function deploySMICanary(kubectl: Kubectl, filePaths: string[]) {
    const newObjectsList = [];
    const canaryReplicaCount = parseInt(TaskInputParameters.baselineAndCanaryReplicas);

    filePaths.forEach((filePath: string) => {
        const fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {

            const name = inputObject.metadata.name;
            const kind = inputObject.kind;
            if (helper.isDeploymentEntity(kind)) {
                const existingCanaryObject = canaryDeploymentHelper.fetchCanaryResource(kubectl, kind, name);

                if (!!existingCanaryObject) {
                    throw (tl.loc('CanaryDeploymentAlreadyExistErrorMessage'));
                }
                tl.debug('Replica count is ' + canaryReplicaCount);
                // Get stable object
                tl.debug('Querying stable object');
                const stableObject = canaryDeploymentHelper.fetchResource(kubectl, kind, name);
                if (!stableObject) {
                    tl.debug('Stable object not found. Creating only canary object');
                    // If stable object not found, create canary deployment.
                    const newCanaryObject = canaryDeploymentHelper.getNewCanaryResource(inputObject, canaryReplicaCount);
                    tl.debug('New canary object is: ' + JSON.stringify(newCanaryObject));
                    newObjectsList.push(newCanaryObject);
                } else {
                    tl.debug('Stable object found. Creating canary and baseline objects');
                    // If canary object not found, create canary and baseline object.
                    const newCanaryObject = canaryDeploymentHelper.getNewCanaryResource(inputObject, canaryReplicaCount);
                    const newBaselineObject = canaryDeploymentHelper.getNewBaselineResource(stableObject, canaryReplicaCount);
                    tl.debug('New canary object is: ' + JSON.stringify(newCanaryObject));
                    tl.debug('New baseline object is: ' + JSON.stringify(newBaselineObject));
                    newObjectsList.push(newCanaryObject);
                    newObjectsList.push(newBaselineObject);
                }
            } else {
                // Updating non deployment entity as it is.
                newObjectsList.push(inputObject);
            }
        });
    });

    const manifestFiles = fileHelper.writeObjectsToFile(newObjectsList);
    const result = kubectl.apply(manifestFiles);
    createCanaryService(kubectl, filePaths);
    return { 'result': result, 'newFilePaths': manifestFiles };
}

function createCanaryService(kubectl: Kubectl, filePaths: string[]) {
    const newObjectsList = [];
    const trafficObjectsList = [];

    filePaths.forEach((filePath: string) => {
        const fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {

            const name = inputObject.metadata.name;
            const kind = inputObject.kind;
            if (helper.isServiceEntity(kind)) {
                const newCanaryServiceObject = getNewCanaryService(inputObject);
                tl.debug('New canary service object is: ' + JSON.stringify(newCanaryServiceObject));
                newObjectsList.push(newCanaryServiceObject);

                const newBaselineServiceObject = getNewBaselineService(inputObject);
                tl.debug('New baseline object is: ' + JSON.stringify(newBaselineServiceObject));
                newObjectsList.push(newBaselineServiceObject);

                tl.debug('Querying for stable service object');
                const stableObject = canaryDeploymentHelper.fetchResource(kubectl, kind, getStableResourceName(name));
                if (!stableObject) {
                    const newStableServiceObject = getStableService(inputObject);
                    tl.debug('New stable service object is: ' + JSON.stringify(newStableServiceObject));
                    newObjectsList.push(newStableServiceObject);

                    tl.debug('Creating the traffic object for service: ' + name);
                    const trafficObject = createTrafficSplitManifestFile(name, 0, 0, 1000);
                    tl.debug('Creating the traffic object for service: ' + trafficObject);
                    trafficObjectsList.push(trafficObject);
                } else {
                    tl.debug('Stable service object present so updating the traffic object for service: ' + name);
                    trafficObjectsList.push(updateTrafficSplitObject(name));
                }
            }
        });
    });

    const manifestFiles = fileHelper.writeObjectsToFile(newObjectsList);
    manifestFiles.push(...trafficObjectsList);
    const result = kubectl.apply(manifestFiles);
    utils.checkForErrors([result]);
}

export function redirectTrafficToCanaryDeployment(kubectl: Kubectl, manifestFilePaths: string[]) {
    adjustTraffic(kubectl, manifestFilePaths, 0, 1000);
}

export function redirectTrafficToStableDeployment(kubectl: Kubectl, manifestFilePaths: string[]) {
    adjustTraffic(kubectl, manifestFilePaths, 1000, 0);
}

function getStableService(inputObject: any): object {
    const newObject = JSON.parse(JSON.stringify(inputObject));

    // Updating name
    newObject.metadata.name = getStableResourceName(inputObject.metadata.name);
    const newLabels = new Map<string, string>();
    newLabels[canaryDeploymentHelper.CANARY_VERSION_LABEL] = canaryDeploymentHelper.STABLE_LABEL_VALUE;

    helper.updateSelectorLabels(newObject, newLabels, false);

    return newObject;
}

function getStableResourceName(name: string) {
    return name + canaryDeploymentHelper.STABLE_SUFFIX;
}

function getNewBaselineService(inputObject: any): object {
    return getNewServiceObject(inputObject, canaryDeploymentHelper.BASELINE_LABEL_VALUE);
}

function getNewCanaryService(inputObject: any): object {
    return getNewServiceObject(inputObject, canaryDeploymentHelper.CANARY_LABEL_VALUE);
}

function getNewServiceObject(inputObject: any, type: string): object {
    const newObject = JSON.parse(JSON.stringify(inputObject));
    // Updating name
    newObject.metadata.name = type === canaryDeploymentHelper.CANARY_LABEL_VALUE ?
        canaryDeploymentHelper.getCanaryResourceName(inputObject.metadata.name) :
        canaryDeploymentHelper.getBaselineResourceName(inputObject.metadata.name);

    const newLabels = new Map<string, string>();
    newLabels[canaryDeploymentHelper.CANARY_VERSION_LABEL] = type;

    helper.updateSelectorLabels(newObject, newLabels, false);

    return newObject;
}

function adjustTraffic(kubectl: Kubectl, manifestFilePaths: string[], stableWeight: number, canaryWeight: number) {
    // get manifest files
    const inputManifestFiles: string[] = utils.getManifestFiles(manifestFilePaths);

    if (inputManifestFiles == null || inputManifestFiles.length == 0) {
       return;
    }

    const trafficSplitManifests = [];
    const serviceObjects = [];
    inputManifestFiles.forEach((filePath: string) => {
        const fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {
            const name = inputObject.metadata.name;
            const kind = inputObject.kind;
            if (helper.isServiceEntity(kind)) {
                trafficSplitManifests.push(createTrafficSplitManifestFile(name, stableWeight, 0, canaryWeight));
                serviceObjects.push(name);
            }
        });
    });

    if (trafficSplitManifests.length <= 0) {
        return;
    }

    const result = kubectl.apply(trafficSplitManifests);
    tl.debug('serviceObjects:' + serviceObjects.join(',') + ' result:' + result);
    utils.checkForErrors([result]);
}

function updateTrafficSplitObject(serviceName: string): string {
    const percentage = parseInt(TaskInputParameters.canaryPercentage) * 10;
    const baselineAndCanaryWeight = percentage / 2;
    return createTrafficSplitManifestFile(serviceName, 1000 - percentage, baselineAndCanaryWeight, baselineAndCanaryWeight);
}

function createTrafficSplitManifestFile(serviceName: string, stableWeight: number, baselineWeight: number, canaryWeight: number): string {
    const smiObjectString = getTrafficSplitObject(serviceName, stableWeight, baselineWeight, canaryWeight);
    const manifestFile = fileHelper.writeManifestToFile(smiObjectString, TRAFFIC_SPLIT_OBJECT, serviceName);
    if (!manifestFile) {
        throw new Error(tl.loc('UnableToCreateTrafficSplitManifestFile'));
    }

    return manifestFile;
}

function getTrafficSplitObject(name: string, stableWeight: number, baselineWeight: number, canaryWeight: number): string {
    const trafficSplitObjectJson = `{
        "apiVersion": "split.smi-spec.io/v1alpha1",
        "kind": "TrafficSplit",
        "metadata": {
            "name": "%s"
        },
        "spec": {
            "backends": [
                {
                    "service": "%s",
                    "weight": "%sm"
                },
                {
                    "service": "%s",
                    "weight": "%sm"
                },
                {
                    "service": "%s",
                    "weight": "%sm"
                }
            ],
            "service": "%s"
        }
    }`;

    const trafficSplitObject = util.format(trafficSplitObjectJson, getTrafficSplitResourceName(name), getStableResourceName(name), stableWeight, canaryDeploymentHelper.getBaselineResourceName(name), baselineWeight, canaryDeploymentHelper.getCanaryResourceName(name), canaryWeight, name);
    return trafficSplitObject;
}

function getTrafficSplitResourceName(name: string) {
    return name + TRAFFIC_SPLIT_OBJECT_NAME_SUFFIX;
}