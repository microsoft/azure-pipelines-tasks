"use strict";
import fs = require("fs");
import tl = require('vsts-task-lib/task');
import yaml = require('js-yaml');
import { Resource } from "kubernetes-common/kubectl-object-model";
import { KubernetesWorkload, recognizedWorkloadTypes } from "../models/constants";
import * as utils from "../utils/utilities"
import { StringComparer } from "../utils/utilities"

export function isDeploymentEntity(kind: string): boolean {
    if (!kind) {
        throw (tl.loc("ResourceKindNotDefined"));
    }

    return recognizedWorkloadTypes.some(function (elem) {
        return utils.isEqual(elem, kind, utils.StringComparer.OrdinalIgnoreCase);
    });
}

export function getReplicaCount(inputObject: any): any {
    if (!inputObject) {
        throw (tl.loc("NullInputObject"));
    }

    if (!inputObject.kind) {
        throw (tl.loc("ResourceKindNotDefined"));
    }

    var kind = inputObject.kind;
    if (!utils.isEqual(kind, KubernetesWorkload.Pod, StringComparer.OrdinalIgnoreCase) && !utils.isEqual(kind, KubernetesWorkload.DaemonSet, StringComparer.OrdinalIgnoreCase)) {
        return inputObject.spec.replicas;
    }

    return 0;
}

export function updateObjectLabels(inputObject: any, newLabels: Map<string, string>, override: boolean) {

    if (!inputObject) {
        throw (tl.loc("NullInputObject"));
    }

    if (!inputObject.metadata) {
        throw (tl.loc("NullInputObjectMetadata"));
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
        throw (tl.loc("NullInputObject"));
    }

    if (!inputObject.metadata) {
        throw (tl.loc("NullInputObjectMetadata"));
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

export function updateImagePullSecrets(inputObject: any, newImagePullSecrets: string[], override: boolean) {
    if (!inputObject) {
        return;
    }

    if (!inputObject.spec) {
        return;
    }

    if (!newImagePullSecrets) {
        return;
    }

    var newImagePullSecretsObjects = [];

    newImagePullSecrets.forEach(imagePullSecret => {
        var newImagePullSecretsObject = {
            "name": imagePullSecret
        };

        newImagePullSecretsObjects.push(newImagePullSecretsObject);
    });

    var existingImagePullSecretObjects: any = getImagePullSecrets(inputObject);

    if (override) {
        existingImagePullSecretObjects = newImagePullSecretsObjects;
    } else {
        if (!existingImagePullSecretObjects) {
            existingImagePullSecretObjects = new Array();
        }

        existingImagePullSecretObjects = existingImagePullSecretObjects.concat(newImagePullSecretsObjects);
    }

    setImagePullSecrets(inputObject, existingImagePullSecretObjects);
}

export function updateSpecLabels(inputObject: any, newLabels: Map<string, string>, override: boolean) {
    if (!inputObject) {
        throw (tl.loc("NullInputObject"));
    }

    if (!inputObject.kind) {
        throw (tl.loc("ResourceKindNotDefined"));
    }

    if (!newLabels) {
        return;
    }

    var existingLabels = getSpecLabels(inputObject);

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
        throw (tl.loc("NullInputObject"));
    }

    if (!inputObject.kind) {
        throw (tl.loc("ResourceKindNotDefined"));
    }

    if (!newLabels) {
        return;
    }

    if (utils.isEqual(inputObject.kind, KubernetesWorkload.Pod, StringComparer.OrdinalIgnoreCase)) {
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
            let inputObjectKind = inputObject ? inputObject.kind : "";
            if (filterResourceTypes.filter(type => utils.isEqual(inputObjectKind, type, StringComparer.OrdinalIgnoreCase)).length > 0) {
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

    if (!inputObject) {
        return null;
    }

    if (utils.isEqual(inputObject.kind, KubernetesWorkload.Pod, StringComparer.OrdinalIgnoreCase)) {
        return inputObject.metadata.labels
    }
    if (!!inputObject.spec && !!inputObject.spec.template && !!inputObject.spec.template.metadata) {
        return inputObject.spec.template.metadata.labels;
    }

    return null;
}

function getImagePullSecrets(inputObject: any) {

    if (!inputObject || !inputObject.spec) {
        return null;
    }

    if (utils.isEqual(inputObject.kind, KubernetesWorkload.Pod, StringComparer.OrdinalIgnoreCase)) {
        return inputObject.spec.imagePullSecrets
    }

    if (!!inputObject.spec.template && !!inputObject.spec.template.spec) {
        return inputObject.spec.template.spec.imagePullSecrets;
    }

    return null;
}

function setImagePullSecrets(inputObject: any, newImagePullSecrets: any) {
    if (!inputObject || !inputObject.spec || !newImagePullSecrets) {
        return;
    }

    if (utils.isEqual(inputObject.kind, KubernetesWorkload.Pod, StringComparer.OrdinalIgnoreCase)) {
        inputObject.spec.imagePullSecrets = newImagePullSecrets;
        return;
    }

    if (!!inputObject.spec.template && !!inputObject.spec.template.spec) {
        inputObject.spec.template.spec.imagePullSecrets = newImagePullSecrets;
        return;
    }

    return;
}

function setSpecLabels(inputObject: any, newLabels: any) {
    var specLabels = getSpecLabels(inputObject);
    if (!!newLabels) {
        specLabels = newLabels;
    }
}

function getSpecSelectorLabels(inputObject: any) {

    if (!!inputObject && !!inputObject.spec && !!inputObject.spec.selector) {
        return inputObject.spec.selector.matchLabels;
    }

    return null;
}

function setSpecSelectorLabels(inputObject: any, newLabels: any) {

    var selectorLabels = getSpecSelectorLabels(inputObject);
    if (!!selectorLabels) {
        selectorLabels = newLabels;
    }
}