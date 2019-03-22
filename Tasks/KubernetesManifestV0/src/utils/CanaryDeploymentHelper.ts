"use strict";
import { Kubectl } from "utility-common/kubectl-object-model";
import * as helper from './KubernetesObjectUtility';
import { KubernetesWorkload, recognizedWorkloadTypes } from "../models/constants"
import * as utils from "./utilities";
import tl = require('vsts-task-lib/task');

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

export function fetchResource(kubectl: Kubectl, kind: string, name: string): object {
    var result = kubectl.getResource(kind, name);
    return result.stderr ? null : JSON.parse(result.stdout);
}

export function fetchCanaryResource(kubectl: Kubectl, kind: string, name: string): object {
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

function getCanaryResourceName(name: string) {
    return name + CANARY_SUFFIX;
}

function getBaselineResourceName(name: string) {
    return name + BASELINE_SUFFIX;
}