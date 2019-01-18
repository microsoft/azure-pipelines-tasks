"use strict";
import fs = require("fs");
import tl = require('vsts-task-lib/task');
import yaml = require('js-yaml');
import { IExecSyncResult } from 'vsts-task-lib/toolrunner';
import { Resource } from "utility-common/kubectl-object-model";

export class KubernetesWorkload {
    static Pod: string = "Pod";
    static Replicaset: string = "Replicaset";
    static Deployment: string = "Deployment";
    static StatefulSet: string = "StatefulSet";
    static DaemonSet: string = "DaemonSet";
}

export function getReplicaCount(inputObject: any): any {
    if (!inputObject) {
        throw new Error("Input object is null.");
    }

    if (!inputObject.kind) {
        throw new Error("Input object kind is not defined.");
    }

    var kind = inputObject.kind;
    if (kind.toUpperCase() != KubernetesWorkload.Pod.toUpperCase() && kind.toUpperCase() != KubernetesWorkload.DaemonSet.toUpperCase()) {
        return inputObject.spec.replicas;
    }

    return 0;
}

export function updateObjectLabels(inputObject: any, newLabels: Map<string, string>, override: boolean) {

    if (!inputObject) {
        throw new Error("Input object is null.");
    }

    if (!inputObject.metadata) {
        throw new Error("Input object metadata is not defined.");
    }

    if (!newLabels) {
        return;
    }

    if (override) {
        inputObject.metadata.labels = newLabels;
    } else {
        var existingLabels = inputObject.metadata.labels;
        if (!existingLabels) {
            existingLabels = new Map<string, string>();
        }

        Object.keys(newLabels).forEach(function (key) {
            existingLabels[key] = newLabels[key];
        });

        inputObject.metadata.labels = existingLabels;
    }
}

export function updateObjectAnnotations(inputObject: any, newAnnotations: Map<string, string>, override: boolean) {
    if (!inputObject) {
        throw new Error("Input object is null.");
    }

    if (!inputObject.metadata) {
        throw new Error("Input object metadata is not defined.");
    }

    if (!newAnnotations) {
        return;
    }
    if (override) {
        inputObject.metadata.annotations = newAnnotations;
    } else {
        var existingAnnotations = inputObject.metadata.annotations;
        if (!existingAnnotations) {
            existingAnnotations = new Map<string, string>();
        }

        Object.keys(newAnnotations).forEach(function (key) {
            existingAnnotations[key] = newAnnotations[key];
        });

        inputObject.metadata.annotations = existingAnnotations;
    }
}

export function updateSpecLabels(inputObject: any, newLabels: Map<string, string>, override: boolean) {
    if (!inputObject) {
        throw new Error("Input object is null.");
    }

    if (!inputObject.kind) {
        throw new Error("Input object kind is not defined.");
    }

    if (!newLabels) {
        return;
    }

    var existingLabels = inputObject.kind.toUpperCase() == KubernetesWorkload.Pod.toUpperCase() ? inputObject.metadata.labels : getSpecLabels(inputObject);

    if (override) {
        existingLabels = newLabels;
    } else {
        if (!existingLabels) {
            existingLabels = new Map<string, string>();
        }

        Object.keys(newLabels).forEach(function (key) {
            existingLabels[key] = newLabels[key];
        });
    }

    setSpecLabels(inputObject, existingLabels);
}

export function updateSelectorLabels(inputObject: any, newLabels: Map<string, string>, override: boolean) {
    if (!inputObject) {
        throw new Error("Input object is null.");
    }

    if (!inputObject.kind) {
        throw new Error("Input object kind is not defined.");
    }

    if (!newLabels) {
        return;
    }

    if (inputObject.kind.toUpperCase() == KubernetesWorkload.Pod.toUpperCase()) {
        return;
    }

    var existingLabels = getSpecSelectorLabels(inputObject);

    if (override) {
        existingLabels = newLabels;
    } else {
        if (!existingLabels) {
            existingLabels = new Map<string, string>();
        }

        Object.keys(newLabels).forEach(function (key) {
            existingLabels[key] = newLabels[key];
        });
    }

    setSpecSelectorLabels(inputObject, existingLabels);
}

export function getResources(filePaths: string[], filterResourceTypes: string[]): Resource[] {

    if (!filePaths) {
        return [];
    }

    let resources: Resource[] = [];

    filePaths.forEach((filePath: string) => {
        var fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {

            if (filterResourceTypes.filter(type => inputObject.kind.toUpperCase() == type.toUpperCase()).length > 0) {
                var resource = {
                    type: inputObject.kind,
                    name: inputObject.metadata.name
                };
                resources.push(resource);
            };
        });
    });
    return resources;
}

function getSpecLabels(inputObject: any) {

    if (!!inputObject && !!inputObject.spec && !!inputObject.spec.template && !!inputObject.spec.template.metadata) {
        return inputObject.spec.template.metadata.labels;
    }

    return null;
}

function setSpecLabels(inputObject: any, newLabels: any) {
    if (!!inputObject && !!inputObject.spec && !!inputObject.spec.template && !!inputObject.spec.template.metadata) {
        inputObject.spec.template.metadata.labels = newLabels;
    }
}

function getSpecSelectorLabels(inputObject: any) {

    if (!!inputObject && !!inputObject.spec && !!inputObject.spec.selector) {
        return inputObject.spec.selector.matchLabels;
    }

    return null;
}

function setSpecSelectorLabels(inputObject: any, newLabels: any) {

    if (!!inputObject && !!inputObject.spec && !!inputObject.spec.selector) {
        inputObject.spec.selector.matchLabels = newLabels;
    }
}