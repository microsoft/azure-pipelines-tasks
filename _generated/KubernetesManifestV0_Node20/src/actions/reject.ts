'use strict';
import * as tl from 'azure-pipelines-task-lib/task';
import * as canaryDeploymentHelper from '../utils/CanaryDeploymentHelper';
import * as SMICanaryDeploymentHelper from '../utils/SMICanaryDeploymentHelper';
import { Kubectl } from 'azure-pipelines-tasks-kubernetes-common/kubectl-object-model';
import * as utils from '../utils/utilities';
import * as TaskInputParameters from '../models/TaskInputParameters';

export async function reject(ignoreSslErrors?: boolean) {
    const kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace, ignoreSslErrors);

    if (!canaryDeploymentHelper.isCanaryDeploymentStrategy()) {
        tl.debug('Strategy is not canary deployment. Invalid request.');
        throw (tl.loc('InvalidRejectActionDeploymentStrategy'));
    }

    let includeServices = false;
    if (canaryDeploymentHelper.isSMICanaryStrategy()) {
        tl.debug('Reject deployment with SMI canary strategy');
        includeServices = true;
        SMICanaryDeploymentHelper.redirectTrafficToStableDeployment(kubectl, TaskInputParameters.manifests);
    }

    tl.debug('Deployment strategy selected is Canary. Deleting baseline and canary workloads.');
    canaryDeploymentHelper.deleteCanaryDeployment(kubectl, TaskInputParameters.manifests, includeServices);
}