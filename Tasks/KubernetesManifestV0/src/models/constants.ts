"use strict";

import tl = require('vsts-task-lib/task');

export class KubernetesWorkload {
    static Pod: string = "Pod";
    static Replicaset: string = "Replicaset";
    static Deployment: string = "Deployment";
    static StatefulSet: string = "StatefulSet";
    static DaemonSet: string = "DaemonSet";
}

export const recognizedWorkloadTypes: string[] = ["deployment", "replicaset", "daemonset", "pod", "statefulset"];
export const recognizedWorkloadTypesWithRolloutStatus: string[] = ["deployment", "daemonset", "statefulset"];
export const pipelineAnnotations: string[] = [
    `azure-pipelines/execution=${tl.getVariable("Build.BuildNumber")}`,
    `azure-pipelines/pipeline="${tl.getVariable("Build.DefinitionName")}"`,
    `azure-pipelines/executionuri=${tl.getVariable("System.TeamFoundationCollectionUri")}_build/results?buildId=${tl.getVariable("Build.BuildId")}`,
    `azure-pipelines/project=${tl.getVariable("System.TeamProject")}`,
    `azure-pipelines/org=${tl.getVariable("System.CollectionId")}`
];