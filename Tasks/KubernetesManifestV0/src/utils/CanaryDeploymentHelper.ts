'use strict';

import { Kubectl } from 'kubernetes-common-v2/kubectl-object-model';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

import * as TaskInputParameters from '../models/TaskInputParameters';
import * as fileHelper from '../utils/FileHelper';
import * as helper from './KubernetesObjectUtility';
import { KubernetesWorkload } from 'kubernetes-common-v2/kubernetesconstants';
import { StringComparer, isEqual } from '../utils/StringComparison';
import * as utils from './utilities';

export const CANARY_DEPLOYMENT_STRATEGY = 'CANARY';
const BASELINE_SUFFIX = '-baseline';
const BASELINE_LABEL_VALUE = 'baseline';
const CANARY_SUFFIX = '-canary';
const CANARY_LABEL_VALUE = 'canary';
const CANARY_VERSION_LABEL = 'azure-pipelines/version';

export function deleteCanaryDeployment(kubectl: Kubectl, manifestFilePaths: string[]) {

    // get manifest files
    const inputManifestFiles: string[] = utils.getManifestFiles(manifestFilePaths);

    if (inputManifestFiles == null || inputManifestFiles.length == 0) {
        throw (tl.loc('ManifestFileNotFound'));
    }

    // create delete cmd prefix
    let argsPrefix: string;
    argsPrefix = createCanaryObjectsArgumentString(inputManifestFiles);

    // append delete cmd args as suffix (if present)
    const args = utils.getDeleteCmdArgs(argsPrefix, TaskInputParameters.args);
    tl.debug('Delete cmd args : ' + args);

    if (!!args && args.length > 0) {
        // run kubectl delete cmd
        const result = kubectl.delete(args);
        utils.checkForErrors([result]);
    }
}

export function deployCanary(kubectl: Kubectl, filePaths: string[]) {
    const newObjectsList = [];
    const percentage = parseInt(TaskInputParameters.canaryPercentage);

    filePaths.forEach((filePath: string) => {
        const fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {

            const name = inputObject.metadata.name;
            const kind = inputObject.kind;
            if (helper.isDeploymentEntity(kind)) {
                const existingCanaryObject = fetchCanaryResource(kubectl, kind, name);

                if (!!existingCanaryObject) {
                    throw (tl.loc('CanaryDeploymentAlreadyExistErrorMessage'));
                }

                tl.debug('Calculating replica count for canary');
                const canaryReplicaCount = calculateReplicaCountForCanary(inputObject, percentage);
                tl.debug('Replica count is ' + canaryReplicaCount);
                // Get stable object
                tl.debug('Querying stable object');
                const stableObject = fetchResource(kubectl, kind, name);
                if (!stableObject) {
                    tl.debug('Stable object not found. Creating only canary object');
                    // If stable object not found, create canary deployment.
                    const newCanaryObject = getNewCanaryResource(inputObject, canaryReplicaCount);
                    tl.debug('New canary object is: ' + JSON.stringify(newCanaryObject));
                    newObjectsList.push(newCanaryObject);
                } else {
                    tl.debug('Stable object found. Creating canary and baseline objects');
                    // If canary object not found, create canary and baseline object.
                    const newCanaryObject = getNewCanaryResource(inputObject, canaryReplicaCount);
                    const newBaselineObject = getNewBaselineResource(stableObject, canaryReplicaCount);
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
    return { 'result': result, 'newFilePaths': manifestFiles };
}

export function isCanaryDeploymentStrategy() {
    const deploymentStrategy = TaskInputParameters.deploymentStrategy;
    return deploymentStrategy && deploymentStrategy.toUpperCase() === CANARY_DEPLOYMENT_STRATEGY;
}

function calculateReplicaCountForCanary(inputObject: any, percentage: number) {
    const inputReplicaCount = helper.getReplicaCount(inputObject);
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
    const result = kubectl.getResource(kind, name);

    if (result == null || !!result.stderr) {
        return null;
    }

    if (!!result.stdout) {
        const resource = JSON.parse(result.stdout);
        try {
            UnsetsClusterSpecficDetails(resource);
            return resource;
        } catch (ex) {
            tl.debug('Exception occurred while Parsing ' + resource + ' in Json object');
            tl.debug(`Exception:${ex}`);
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
        const metadata = resource.metadata;
        const status = resource.status;

        if (!!metadata) {
            const newMetadata = {
                'annotations': metadata.annotations,
                'labels': metadata.labels,
                'name': metadata.name
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
    const newObject = JSON.parse(JSON.stringify(inputObject));

    // Updating name
    newObject.metadata.name = type === CANARY_LABEL_VALUE ?
        getCanaryResourceName(inputObject.metadata.name) :
        getBaselineResourceName(inputObject.metadata.name);

    // Adding labels and annotations.
    addCanaryLabelsAndAnnotations(newObject, type);

    // Updating no. of replicas
    if (!isEqual(newObject.kind, KubernetesWorkload.pod, StringComparer.OrdinalIgnoreCase) &&
        !isEqual(newObject.kind, KubernetesWorkload.daemonSet, StringComparer.OrdinalIgnoreCase)) {
        newObject.spec.replicas = replicas;
    }

    return newObject;
}

function addCanaryLabelsAndAnnotations(inputObject: any, type: string) {
    const newLabels = new Map<string, string>();
    newLabels[CANARY_VERSION_LABEL] = type;

    helper.updateObjectLabels(inputObject, newLabels, false);
    helper.updateObjectAnnotations(inputObject, newLabels, false);
    helper.updateSelectorLabels(inputObject, newLabels, false);
    helper.updateSpecLabels(inputObject, newLabels, false);
}

function createCanaryObjectsArgumentString(files: string[]) {
    const kindList = new Set();
    const nameList = new Set();

    files.forEach((filePath: string) => {
        const fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {
            const name = inputObject.metadata.name;
            const kind = inputObject.kind;
            if (helper.isDeploymentEntity(kind)) {
                const canaryObjectName = getCanaryResourceName(name);
                const baselineObjectName = getBaselineResourceName(name);
                kindList.add(kind);
                nameList.add(canaryObjectName);
                nameList.add(baselineObjectName);
            }
        });
    });

    if (kindList.size === 0) {
        tl.debug('CanaryDeploymentHelper : No deployment objects found');
    }

    const args = utils.createKubectlArgs(kindList, nameList);
    return args;
}