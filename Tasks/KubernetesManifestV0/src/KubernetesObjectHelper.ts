"use strict";
import { Kubectl, Resource } from "utility-common/kubectl-object-model";
import * as utils from "./utilities";
import path = require('path');
import fs = require("fs");
import { stringify } from "querystring";

const CANARY_SUFFIX = "-canary";
const BASELINE_SUFFIX = "-baseline";
const CANARY_VERSION_LABEL = "azure-pipelines/version";
const CANARY_LABEL_VALUE = "canary";
const BASELINE_LABEL_VALUE = "baseline";

class KubernetesPropery
{
    static PodSpec = "PodSpec";
    static PodMetadata = "PodMetadata";
    static Replicas = "Replicas"; 
    static ObjectLabels = "ObjectLabels";
    static SelectorMatchLabels = "SelectorMatchLabels"
}

class KubernetesWorkload {
    static Pod = "Pod";
    static Replicaset = "Replicaset";
    static Deployment = "Deployment";
    static StatefulSet = "StatefulSet";
    static DaemonSet = "DaemonSet";
}

export class CanaryMetdata {
   input_object: any;
   stable_object: any;
   existing_canary_object: any;
   existing_baseline_object: any;
}

export class PropertyDiff {
    oldValue: any;
    newValue: any;

    constructor(oldValue: any, newValue: any){
        this.oldValue = oldValue,
        this.newValue = newValue
    }
}

export class DiffOutput {
    propertyDiffs: PropertyDiff[];
}

export function diff(oldObject: any, newObject: any): Map<KubernetesPropery, PropertyDiff> {

    if (oldObject.kind != newObject.kind)
    {
        return {} as Map<KubernetesPropery, PropertyDiff>; //TODO handle this case
    }

    var kind = oldObject.kind;

    var oldObjectPodSpec;
    var oldSelectorMatchLabels;

    var newObjectPodSpec;
    var newSelectorMatchLabels;
    var diffOutput = new  Map<KubernetesPropery, PropertyDiff>();

    if (kind.toUpperCase() === KubernetesWorkload.Pod.toUpperCase() || kind.toUpperCase() === KubernetesWorkload.DaemonSet.toUpperCase()){
        oldObjectPodSpec = oldObject.spec; 
        newObjectPodSpec = newObject.spec;
        diffOutput[KubernetesPropery.PodMetadata]= new PropertyDiff(oldObject.metadata, newObject.spec.metadata);
    }else {
        oldObjectPodSpec = oldObject.spec.template.spec;
        oldSelectorMatchLabels = oldObject.spec.selector.matchLabels;

        newObjectPodSpec = newObject.spec.template.spec;
        newSelectorMatchLabels = newObject.spec.selector.matchLabels;

        diffOutput[KubernetesPropery.Replicas]= new PropertyDiff(oldObject.spec.replicas, newObject.spec.replicas);
        diffOutput[KubernetesPropery.PodMetadata]= new PropertyDiff(oldObject.spec.template.metadata, newObject.spec.template.metadata);
        diffOutput[KubernetesPropery.SelectorMatchLabels] =   new PropertyDiff(oldSelectorMatchLabels, newSelectorMatchLabels);
    }

    diffOutput[KubernetesPropery.PodSpec] = new PropertyDiff(oldObjectPodSpec, newObjectPodSpec);
    diffOutput[KubernetesPropery.ObjectLabels] =   new PropertyDiff(oldObject.metadata.labels, newObject.metadata.labels);

    return diffOutput;
}

export function updatePodSpec(inputObject: any, newSpec : any){
    var kind = inputObject.kind;
    if (kind.toUpperCase() === KubernetesWorkload.Pod.toUpperCase()){
        inputObject.spec = newSpec;
    }else {
        inputObject.spec.template.spec = newSpec;
    }
}

export function getPodSpec(inputObject: any): any{
    var kind = inputObject.kind;
    if (kind.toUpperCase() === KubernetesWorkload.Pod.toUpperCase()){
        return inputObject.spec;
    }else {
        return inputObject.spec.template.spec;
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

export function getPodMetdata(inputObject: any){
    var kind = inputObject.kind;
    if (kind.toUpperCase() === KubernetesWorkload.Pod.toUpperCase() ){
        return inputObject.metadata;
    }else {
        return inputObject.spec.template.metadata;
    }
}

export function updateObjectLabelsForCanary(inputObject: any, newLabels: any){
    if (!!!newLabels){
            newLabels = new Map<string, string>();
    }
        
    newLabels[CANARY_VERSION_LABEL] = CANARY_LABEL_VALUE;
    inputObject.metadata.labels = newLabels;
}

export function updateObjectLabelsForBaseline(inputObject: any, newLabels: any){
    if (!!!newLabels){
            newLabels = new Map<string, string>();
    }
        
    newLabels[CANARY_VERSION_LABEL] = BASELINE_LABEL_VALUE;
    inputObject.metadata.labels = newLabels;
}

export function updateObjectLabels(inputObject: any, newLabels: any){
    inputObject.metadata.labels = newLabels;
}

export function getObjectLabels(inputObject: any){
    return inputObject.metadata.labels;
}

export function updateReplicaCount(inputObject: any, newReplicaCount: any){
    var kind = inputObject.kind;
    if (kind.toUpperCase() != KubernetesWorkload.Pod.toUpperCase() && kind.toUpperCase() != KubernetesWorkload.DaemonSet.toUpperCase()){
        inputObject.spec.replicas = newReplicaCount;
    }
}

export function getReplicaCount(inputObject: any): any {
    var kind = inputObject.kind;
    if (kind.toUpperCase() != KubernetesWorkload.Pod.toUpperCase() && kind.toUpperCase() != KubernetesWorkload.DaemonSet.toUpperCase()){
        return inputObject.spec.replicas;
    }

    return 0;
}

export function calculateReplicaCountForCanary(inputObject: any, percentage: number){
    var inputReplicaCount = getReplicaCount(inputObject);
    return Math.floor((inputReplicaCount*percentage)/100);

}

export function isDeploymentEntity(kind: string): boolean {
    var temp = kind.toUpperCase();
    return temp === KubernetesWorkload.Pod.toUpperCase() ||  
           temp === KubernetesWorkload.Replicaset.toUpperCase() ||  
           temp === KubernetesWorkload.Deployment.toUpperCase() ||  
           temp === KubernetesWorkload.StatefulSet.toUpperCase() ||  
           temp === KubernetesWorkload.DaemonSet.toUpperCase();
}

export function applyResource(kubectl: Kubectl, inputObjects: any[]){
    let newFilePaths = [];
    inputObjects.forEach((inputObject: any) => {
        var filePath = inputObject.kind+ "_"+ inputObject.metadata.name;
        var inputObjectString = JSON.stringify(inputObject);
        const tempDirectory = utils.getTempDirectory();
        let fileName = path.join(tempDirectory, path.basename(filePath));
           fs.writeFileSync(
           path.join(fileName),
           inputObjectString);
        newFilePaths.push(fileName);
    });

    if (newFilePaths.length > 0){
        kubectl.apply(newFilePaths);
    }
    return newFilePaths;
}

export function getNewBaselineResource(stableObject: any, replicas: number): object {
    return getNewCanaryObject(stableObject, replicas, BASELINE_LABEL_VALUE);
}

export function getNewCanaryResource(inputObject: any, replicas: number): object {
    return getNewCanaryObject(inputObject, replicas, CANARY_LABEL_VALUE);
}

function getNewCanaryObject(inputObject: any, replicas: number, type: string): object {
    var newObject = JSON.parse(JSON.stringify(inputObject));

    // Updating name
    newObject.metadata.name = type === CANARY_LABEL_VALUE ? getCanaryResourceName(inputObject.metadata.name) : 
                                                            getBaselineResourceName(inputObject.metadata.name);

    // Adding labels and annotations.
    if (!!!newObject.metadata.labels){
        newObject.metadata.labels = new Map<string, string>();
    }
    newObject.metadata.labels[CANARY_VERSION_LABEL] = type;

    if (!!!newObject.metadata.annotations){
        newObject.metadata.annotations = new Map<string, string>();
    }
    newObject.metadata.annotations[CANARY_VERSION_LABEL] = type;
    
    // Updating no. of replicas
    if (newObject.kind.toUpperCase() != KubernetesWorkload.Pod.toUpperCase() && newObject.kind.toUpperCase() != KubernetesWorkload.DaemonSet.toUpperCase())
    {
        newObject.spec.replicas = replicas;
    }

    return newObject;
}

export function fetchResource(kubectl: Kubectl, kind: string, name: string): object {
    var result = kubectl.getResource(kind, name);
    return result.stderr ? null : JSON.parse(result.stdout);
}

export function fetchCanaryResource(kubectl: Kubectl, kind: string, name: string): object {
    return fetchResource(kubectl, kind, getCanaryResourceName(name));
}

export function fetchBaselineResource(kubectl: Kubectl, kind: string, name: string): object {
    return fetchResource(kubectl, kind, getBaselineResourceName(name));
}

function getCanaryResourceName(name: string){
     return name+CANARY_SUFFIX;
}

function getBaselineResourceName(name: string){
    return name+BASELINE_SUFFIX;
}