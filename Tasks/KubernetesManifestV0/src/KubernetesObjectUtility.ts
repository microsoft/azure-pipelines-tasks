"use strict";
import tl = require('vsts-task-lib/task');
import { IExecSyncResult } from 'vsts-task-lib/toolrunner';

class KubernetesWorkload {
    static Pod: string = "Pod";
    static Replicaset: string = "Replicaset";
    static Deployment: string = "Deployment";
    static StatefulSet: string = "StatefulSet";
    static DaemonSet: string = "DaemonSet";
}

export function getObjectLabels(inputObject: any){
    return inputObject.metadata.labels;
}

export function getPodSpec(inputObject: any): any{
    var kind = inputObject.kind;
    if (kind.toUpperCase() === KubernetesWorkload.Pod.toUpperCase()){
        return inputObject.spec;
    }else {
        return inputObject.spec.template.spec;
    }
}

export function getPodMetdata(inputObject: any){
    var kind = inputObject.kind;
    if (kind.toUpperCase() === KubernetesWorkload.Pod.toUpperCase() ){
        return inputObject.metadata;
    }else {
        return inputObject.spec.template.metadata;
    }
}

export function getReplicaCount(inputObject: any): any {
    var kind = inputObject.kind;
    if (!!kind && kind.toUpperCase() != KubernetesWorkload.Pod.toUpperCase() && kind.toUpperCase() != KubernetesWorkload.DaemonSet.toUpperCase()){
        return inputObject.spec.replicas;
    }

    return 0;
}

export function updateObjectLabels(inputObject: any, newLabels: Map<string,string>, override: boolean){
    if (override){
    inputObject.metadata.labels = newLabels;
    } else {
        var labels = inputObject.metadata.labels;
        if (!labels){
            labels = new Map<string, string>();
        }

        newLabels.forEach((key: string, value: string) => {
           labels[key] = value;
        });
    }
}

export function updateObjectAnnotations(inputObject: any, newAnnotations: Map<string,string>, override: boolean){
    if (override){
    inputObject.metadata.labels = newAnnotations;
    } else {
        var annotations = inputObject.metadata.annotations;
        if (!annotations){
            annotations = new Map<string, string>();
        }

        newAnnotations.forEach((key: string, value: string) => {
            annotations[key] = value;
        });
    }
}

export function updatePodLabels(inputObject: any, newLabels: Map<string,string>, override: boolean){
    
    var existingLabels = inputObject.kind.toUpperCase() == KubernetesWorkload.Pod.toUpperCase() ? inputObject.metadata.labels :  inputObject.spec.template.metadata.labels;
    
    if (override){
        existingLabels = newLabels;
    } else {
        if (!existingLabels){
            existingLabels = new Map<string, string>();
        }

        newLabels.forEach((key: string, value: string) => {
            existingLabels[key] = value;
        });
    }
}

export function updateSelectorLabels(inputObject: any, newLabels: Map<string,string>, override: boolean){
    if (inputObject.kind.toUpperCase() == KubernetesWorkload.Pod.toUpperCase() ){
        return;
    }

    var existingLabels = inputObject.spec.selector.matchLabels;
    
    if (override){
        existingLabels = newLabels;
    } else {
        if (!existingLabels){
            existingLabels = new Map<string, string>();
        }

        newLabels.forEach((key: string, value: string) => {
            existingLabels[key] = value;
        });
    }
}

export function updatePodSpec(inputObject: any, newSpec : any){
    var kind = inputObject.kind;
    if (kind.toUpperCase() === KubernetesWorkload.Pod.toUpperCase()){
        inputObject.spec = newSpec;
    }else {
        inputObject.spec.template.spec = newSpec;
    }
}

export function updatePodMetdata(inputObject: any, newMetadata: any){
    var kind = inputObject.kind;
    if (kind.toUpperCase() === KubernetesWorkload.Pod.toUpperCase() ){
        inputObject.metadata = newMetadata;
    }else {
        inputObject.spec.template.metadata = newMetadata;
    }
}

export function updateReplicaCount(inputObject: any, newReplicaCount: any){
    var kind = inputObject.kind;
    if (kind.toUpperCase() != KubernetesWorkload.Pod.toUpperCase() && kind.toUpperCase() != KubernetesWorkload.DaemonSet.toUpperCase()){
        inputObject.spec.replicas = newReplicaCount;
    }
}

export function checkForErrors(execResults: IExecSyncResult[], warnIfError?: boolean) {
    if (execResults.length != 0) {
        var stderr = "";
        execResults.forEach(result => {
            if (result.stderr) {
                stderr += result.stderr + "\n";
            }
        });
        if (stderr.length > 0) {
            if (!!warnIfError)
                tl.warning(stderr.trim());
            else
                throw stderr.trim();
        }
    }
}
