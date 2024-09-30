'use strict';

import * as tl from 'azure-pipelines-task-lib/task';
import { IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';
import * as path from 'path';
import * as utils from './utility';
import * as KubernetesConstants from './kubernetesconstants';
import { Kubectl, Resource } from './kubectl-object-model';

tl.setResourcePath(path.join(__dirname, 'module.json'), true);

export async function checkManifestStability(kubectl: Kubectl, resources: Resource[], timeoutInSeconds?: string): Promise<void> {
    const environmentUrl = getEnvironmentUrl();
    if (environmentUrl)
        tl.debug('For more information, go to ' + environmentUrl);

    let rolloutStatusHasErrors = false;
    const numberOfResources = resources.length;
    for (let i = 0; i < numberOfResources; i++) {
        const resource = resources[i];
        if (KubernetesConstants.workloadTypesWithRolloutStatus.indexOf(resource.type.toLowerCase()) >= 0) {
            if (resource.isStrategyRollingUpdate) {
                try {
                    let result = kubectl.checkRolloutStatus(resource.type, resource.name, timeoutInSeconds);
                    utils.checkForErrors([result]);
                } catch (ex) {
                    tl.error(ex);
                    describeResource(kubectl, resource.type, resource.name, environmentUrl);
                    rolloutStatusHasErrors = true;
                }
            } else {
                tl.debug(`Rollout status has been skipped for ${resource.type} as only updateStartegy:'RollingUpdate' is allowed`);
            }
        }
        if (utils.isEqual(resource.type, KubernetesConstants.KubernetesWorkload.pod, true)) {
            try {
                await checkPodStatus(kubectl, resource.name);
            } catch (ex) {
                tl.warning(tl.loc('CouldNotDeterminePodStatus', JSON.stringify(ex)));
                describeResource(kubectl, resource.type, resource.name, environmentUrl);
            }
        }
        if (utils.isEqual(resource.type, KubernetesConstants.DiscoveryAndLoadBalancerResource.service, true)) {
            try {
                const service = getService(kubectl, resource.name);
                const spec = service.spec;
                const status = service.status;
                if (utils.isEqual(spec.type, KubernetesConstants.ServiceTypes.loadBalancer, true)) {
                    if (!isLoadBalancerIPAssigned(status)) {
                        await waitForServiceExternalIPAssignment(kubectl, resource.name);
                    } else {
                        console.log(tl.loc('ServiceExternalIP', resource.name, status.loadBalancer.ingress[0].ip));
                    }
                }
            } catch (ex) {
                tl.warning(tl.loc('CouldNotDetermineServiceStatus', resource.name, JSON.stringify(ex)));
                describeResource(kubectl, resource.type, resource.name, environmentUrl);
            }
        }
    }

    if (rolloutStatusHasErrors) {
        throw new Error(tl.loc('RolloutStatusTimedout'));
    }
}

export async function checkPodStatus(kubectl: Kubectl, podName: string): Promise<void> {
    const sleepTimeout = 10 * 1000; // 10 seconds
    const iterations = 60; // 60 * 10 seconds timeout = 10 minutes max timeout
    let podStatus;
    for (let i = 0; i < iterations; i++) {
        await utils.sleep(sleepTimeout);
        tl.debug(`Polling for pod status: ${podName}`);
        podStatus = getPodStatus(kubectl, podName);
        if (podStatus.phase && podStatus.phase !== 'Pending' && podStatus.phase !== 'Unknown') {
            break;
        }
    }
    podStatus = getPodStatus(kubectl, podName);
    const environmentUrl = getEnvironmentUrl();
    switch (podStatus.phase) {
        case 'Succeeded':
        case 'Running':
            if (isPodReady(podStatus)) {
                console.log(`pod/${podName} is successfully rolled out`);
            } else {
                describeResource(kubectl, KubernetesConstants.KubernetesWorkload.pod, podName, environmentUrl);
            }
            break;
        case 'Pending':
            if (!isPodReady(podStatus)) {
                tl.warning(`pod/${podName} rollout status check timedout`);
                describeResource(kubectl, KubernetesConstants.KubernetesWorkload.pod, podName, environmentUrl);
            }
            break;
        case 'Failed':
            tl.error(`pod/${podName} rollout failed`);
            describeResource(kubectl, KubernetesConstants.KubernetesWorkload.pod, podName, environmentUrl);
            break;
        default:
            tl.warning(`pod/${podName} rollout status: ${podStatus.phase}`);
    }
}

function getPodStatus(kubectl: Kubectl, podName: string): any {
    const podResult = kubectl.getResource('pod', podName);
    utils.checkForErrors([podResult]);
    const podStatus = JSON.parse(podResult.stdout).status;
    tl.debug(`Pod Status: ${JSON.stringify(podStatus)}`);
    return podStatus;
}

function isPodReady(podStatus: any): boolean {
    let allContainersAreReady = true;
    podStatus.containerStatuses.forEach(container => {
        if (container.ready === false) {
            console.log(`'${container.name}' status: ${JSON.stringify(container.state)}`);
            allContainersAreReady = false;
        }
    });
    if (!allContainersAreReady) {
        tl.warning(tl.loc('AllContainersNotInReadyState'));
    }
    return allContainersAreReady;
}

function getService(kubectl: Kubectl, serviceName) {
    const serviceResult = kubectl.getResource(KubernetesConstants.DiscoveryAndLoadBalancerResource.service, serviceName);
    utils.checkForErrors([serviceResult]);
    return JSON.parse(serviceResult.stdout);
}

async function waitForServiceExternalIPAssignment(kubectl: Kubectl, serviceName: string): Promise<void> {
    const sleepTimeout = 10 * 1000; // 10 seconds
    const iterations = 18; // 18 * 10 seconds timeout = 3 minutes max timeout

    for (let i = 0; i < iterations; i++) {
        console.log(tl.loc('waitForServiceIpAssignment', serviceName));
        await utils.sleep(sleepTimeout);
        let status = getService(kubectl, serviceName).status;
        if (isLoadBalancerIPAssigned(status)) {
            console.log(tl.loc('ServiceExternalIP', serviceName, status.loadBalancer.ingress[0].ip));
            return;
        }
    }
    tl.warning(tl.loc('waitForServiceIpAssignmentTimedOut', serviceName));
}

function isLoadBalancerIPAssigned(status: any) {
    if (status && status.loadBalancer && status.loadBalancer.ingress && status.loadBalancer.ingress.length > 0) {
        return true;
    }
    return false;
}

function getEnvironmentUrl(): string {
    const environmentId = tl.getVariable('Environment.Id');
    let requestUrl = null;
    if (environmentId) {
        requestUrl = tl.getVariable('System.TeamFoundationCollectionUri') + tl.getVariable('System.TeamProject') + '/_environments/' + tl.getVariable('Environment.Id');
        const resourceId = tl.getVariable('Environment.ResourceId');
        requestUrl = resourceId ? requestUrl + '/providers/kubernetes/' + resourceId : requestUrl;
    }

    return requestUrl;
}

function describeResource(kubectl: Kubectl, resourceType: string, resourceName: string, environmentUrl: string) {
    kubectl.describe(resourceType, resourceName);
    if (environmentUrl)
        console.log(tl.loc('EnvironmentLink', environmentUrl));
}