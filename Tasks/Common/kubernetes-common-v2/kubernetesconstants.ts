'use strict';

import * as tl from 'azure-pipelines-task-lib/task';
import { isEqual } from './utility';

export class KubernetesWorkload {
    public static pod: string = 'Pod';
    public static replicaset: string = 'Replicaset';
    public static deployment: string = 'Deployment';
    public static statefulSet: string = 'StatefulSet';
    public static daemonSet: string = 'DaemonSet';
    public static job: string = 'job';
    public static cronjob: string = 'cronjob';
}

export class DiscoveryAndLoadBalancerResource {
    public static service: string = 'service';
    public static ingress: string = 'ingress';
}

export class ServiceTypes {
    public static loadBalancer: string = 'LoadBalancer';
    public static nodePort: string = 'NodePort';
    public static clusterIP: string = 'ClusterIP'
}

export const deploymentTypes: string[] = ['deployment', 'replicaset', 'daemonset', 'pod', 'statefulset'];
export const workloadTypes: string[] = ['deployment', 'replicaset', 'daemonset', 'pod', 'statefulset', 'job', 'cronjob'];
export const workloadTypesWithRolloutStatus: string[] = ['deployment', 'daemonset', 'statefulset'];

const isRelease = isEqual(tl.getVariable('SYSTEM_HOSTTYPE'), 'release', true);
const orgUrl = tl.getVariable('System.TeamFoundationCollectionUri');

export let pipelineAnnotations: string[] = [];

if (isRelease) {
    pipelineAnnotations = [
        `azure-pipelines/run=${tl.getVariable('Release.ReleaseId')}`,
        `azure-pipelines/pipeline="${tl.getVariable('Release.DefinitionName')}"`,
        `azure-pipelines/pipelineId="${tl.getVariable('Release.DefinitionId')}"`,
        `azure-pipelines/jobName="${tl.getVariable('Agent.JobName')}"`,
        `azure-pipelines/runuri=${orgUrl}${tl.getVariable('System.TeamProject')}/_releaseProgress?releaseId=${tl.getVariable('Release.ReleaseId')}`,
        `azure-pipelines/project=${tl.getVariable('System.TeamProject')}`,
        `azure-pipelines/org=${orgUrl}`
    ];
} else {
    pipelineAnnotations = [
        `azure-pipelines/run=${tl.getVariable('Build.BuildNumber')}`,
        `azure-pipelines/pipeline="${tl.getVariable('Build.DefinitionName')}"`,
        `azure-pipelines/pipelineId="${tl.getVariable('System.DefinitionId')}"`,
        `azure-pipelines/jobName="${tl.getVariable('Agent.JobName')}"`,
        `azure-pipelines/runuri=${orgUrl}${tl.getVariable('System.TeamProject')}/_build/results?buildId=${tl.getVariable('Build.BuildId')}`,
        `azure-pipelines/project=${tl.getVariable('System.TeamProject')}`,
        `azure-pipelines/org=${orgUrl}`
    ];
}