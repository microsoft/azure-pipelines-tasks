'use strict';
import * as tl from 'azure-pipelines-task-lib/task';

import * as deploymentHelper from '../utils/DeploymentHelper';
import * as canaryDeploymentHelper from '../utils/CanaryDeploymentHelper';
import * as SMICanaryDeploymentHelper from '../utils/SMICanaryDeploymentHelper';
import * as utils from '../utils/utilities';
import * as TaskInputParameters from '../models/TaskInputParameters';

import { Kubectl } from 'azure-pipelines-tasks-kubernetes-common/kubectl-object-model';

export async function promote(ignoreSslErrors?: boolean) {
    TaskInputParameters.validateTimeoutForRolloutStatus();
    const kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace, ignoreSslErrors);

    if (!canaryDeploymentHelper.isCanaryDeploymentStrategy()) {
        tl.debug('Strategy is not canary deployment. Invalid request.');
        throw (tl.loc('InvalidPromotetActionDeploymentStrategy'));
    }

    let includeServices = false;
    if (canaryDeploymentHelper.isSMICanaryStrategy()) {
        includeServices = true;
        // In case of SMI traffic split strategy when deployment is promoted, first we will redirect traffic to
        // Canary deployment, then update stable deployment and then redirect traffic to stable deployment
        tl.debug('Redirecting traffic to canary deployment');
        SMICanaryDeploymentHelper.redirectTrafficToCanaryDeployment(kubectl, TaskInputParameters.manifests);

        tl.debug('Deploying input manifests with SMI canary strategy');
        await deploymentHelper.deploy(kubectl, TaskInputParameters.manifests, 'None');

        tl.debug('Redirecting traffic to stable deployment');
        SMICanaryDeploymentHelper.redirectTrafficToStableDeployment(kubectl, TaskInputParameters.manifests);
    } else {
        tl.debug('Deploying input manifests');
        await deploymentHelper.deploy(kubectl, TaskInputParameters.manifests, 'None');
    }

    tl.debug('Deployment strategy selected is Canary. Deleting canary and baseline workloads.');
    try {
        canaryDeploymentHelper.deleteCanaryDeployment(kubectl, TaskInputParameters.manifests, includeServices);
    } catch (ex) {
        tl.warning('Exception occurred while deleting canary and baseline workloads. Exception: ' + ex);
    }
}