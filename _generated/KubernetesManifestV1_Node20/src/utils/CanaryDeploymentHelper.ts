'use strict';

import { Kubectl } from 'azure-pipelines-tasks-kubernetes-common/kubectl-object-model';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

import * as TaskInputParameters from '../models/TaskInputParameters';
import * as helper from '../utils/KubernetesObjectUtility';
import { KubernetesWorkload } from 'azure-pipelines-tasks-kubernetes-common/kubernetesconstants';
import { StringComparer, isEqual } from './StringComparison';
import * as utils from '../utils/utilities';

export const CANARY_DEPLOYMENT_STRATEGY = 'CANARY';
export const TRAFFIC_SPLIT_STRATEGY = 'SMI';
export const CANARY_VERSION_LABEL = 'azure-pipelines/version';
const BASELINE_SUFFIX = '-baseline';
export const BASELINE_LABEL_VALUE = 'baseline';
const CANARY_SUFFIX = '-canary';
export const CANARY_LABEL_VALUE = 'canary';
export const STABLE_SUFFIX = '-stable';
export const STABLE_LABEL_VALUE = 'stable';

export function deleteCanaryDeployment(kubectl: Kubectl, manifestFilePaths: string[], includeServices: boolean) {

    // get manifest files
    const inputManifestFiles: string[] = utils.getManifestFiles(manifestFilePaths);

    if (inputManifestFiles == null || inputManifestFiles.length == 0) {
        throw (tl.loc('ManifestFileNotFound'));
    }

    deleteCanaryAndBaselineObjects(kubectl, inputManifestFiles, includeServices);
}

export function markResourceAsStable(inputObject: any): object {
    if (isResourceMarkedAsStable(inputObject)) {
        return inputObject;
    }

    const newObject = JSON.parse(JSON.stringify(inputObject));

    // Adding labels and annotations.
    addCanaryLabelsAndAnnotations(newObject, STABLE_LABEL_VALUE);

    tl.debug("Added stable label: " + JSON.stringify(newObject));
    return newObject;
}

export function isResourceMarkedAsStable(inputObject: any): boolean {
    return inputObject &&
        inputObject.metadata &&
        inputObject.metadata.labels &&
        inputObject.metadata.labels[CANARY_VERSION_LABEL] == STABLE_LABEL_VALUE;
}

export function getStableResource(inputObject: any): object {
    var replicaCount = isSpecContainsReplicas(inputObject.kind) ? inputObject.metadata.replicas : 0;
    return getNewCanaryObject(inputObject, replicaCount, STABLE_LABEL_VALUE);
}

export function getNewBaselineResource(stableObject: any, replicas?: number): object {
    return getNewCanaryObject(stableObject, replicas, BASELINE_LABEL_VALUE);
}

export function getNewCanaryResource(inputObject: any, replicas?: number): object {
    return getNewCanaryObject(inputObject, replicas, CANARY_LABEL_VALUE);
}

export function fetchCanaryResource(kubectl: Kubectl, kind: string, name: string): object {
    return fetchResource(kubectl, kind, getCanaryResourceName(name));
}

export function fetchResource(kubectl: Kubectl, kind: string, name: string): object {
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

export function isCanaryDeploymentStrategy() {
    const deploymentStrategy = TaskInputParameters.deploymentStrategy;
    return deploymentStrategy && deploymentStrategy.toUpperCase() === CANARY_DEPLOYMENT_STRATEGY;
}

export function isSMICanaryStrategy() {
    const deploymentStrategy = TaskInputParameters.trafficSplitMethod;
    return isCanaryDeploymentStrategy() && deploymentStrategy && deploymentStrategy.toUpperCase() === TRAFFIC_SPLIT_STRATEGY;
}

export function getCanaryResourceName(name: string) {
    return name + CANARY_SUFFIX;
}

export function getBaselineResourceName(name: string) {
    return name + BASELINE_SUFFIX;
}

export function getStableResourceName(name: string) {
    return name + STABLE_SUFFIX;
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

function getNewCanaryObject(inputObject: any, replicas: number, type: string): object {
    const newObject = JSON.parse(JSON.stringify(inputObject));

    // Updating name
    if (type === CANARY_LABEL_VALUE) {
        newObject.metadata.name = getCanaryResourceName(inputObject.metadata.name)
    } else if (type === STABLE_LABEL_VALUE) {
        newObject.metadata.name = getStableResourceName(inputObject.metadata.name)
    } else {
        newObject.metadata.name = getBaselineResourceName(inputObject.metadata.name);
    }

    // Adding labels and annotations.
    addCanaryLabelsAndAnnotations(newObject, type);

    // Updating no. of replicas
    if (isSpecContainsReplicas(newObject.kind)) {
        newObject.spec.replicas = replicas;
    }

    return newObject;
}

function isSpecContainsReplicas(kind: string) {
    return !isEqual(kind, KubernetesWorkload.pod, StringComparer.OrdinalIgnoreCase) &&
        !isEqual(kind, KubernetesWorkload.daemonSet, StringComparer.OrdinalIgnoreCase) &&
        !helper.isServiceEntity(kind)
}

function addCanaryLabelsAndAnnotations(inputObject: any, type: string) {
    const newLabels = new Map<string, string>();
    newLabels[CANARY_VERSION_LABEL] = type;

    helper.updateObjectLabels(inputObject, newLabels, false);
    helper.updateObjectAnnotations(inputObject, newLabels, false);
    helper.updateSelectorLabels(inputObject, newLabels, false);

    if (!helper.isServiceEntity(inputObject.kind)) {
        helper.updateSpecLabels(inputObject, newLabels, false);
    }
}

function addValueToList(map: any, key: string, value: string) {
    map[key] = map[key] || new Set<string>();
    map[key].add(value);
}

function deleteCanaryAndBaselineObjects(kubectl: Kubectl, files: string[], includeServices: boolean) {
    var kindNameMap = {};
    files.forEach((filePath: string) => {
        const fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {
            const name = inputObject.metadata.name;
            const kind = inputObject.kind;
            if (helper.isDeploymentEntity(kind)
                || (includeServices && helper.isServiceEntity(kind))) {
                const canaryObjectName = getCanaryResourceName(name);
                const baselineObjectName = getBaselineResourceName(name);
                addValueToList(kindNameMap, kind, canaryObjectName);
                const result = kubectl.getResource(kind, baselineObjectName);
                if (result != null && !result.stderr) {
                    addValueToList(kindNameMap, kind, baselineObjectName);
                }
            }
        });
    });

    const kindList = Object.keys(kindNameMap);
    if (kindList.length === 0) {
        tl.debug('CanaryDeploymentHelper : No deployment objects found');
    }
    kindList.forEach(kind => {
        const argsPrefix = utils.createKubectlArgs(kind, kindNameMap[kind]);
        const args = utils.getDeleteCmdArgs(argsPrefix, TaskInputParameters.args);
        tl.debug('Delete cmd args : ' + args);

        if (!!args && args.length > 0) {
            // run kubectl delete cmd
            const result = kubectl.delete(args);
            utils.checkForErrors([result]);
        }
    })
}
