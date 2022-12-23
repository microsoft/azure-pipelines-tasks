'use strict';

import * as deploymentHelper from '../utils/DeploymentHelper';
import * as TaskInputParameters from '../models/TaskInputParameters';
import * as utils from '../utils/utilities';
import { Kubectl } from 'azure-pipelines-tasks-kubernetes-common-v2/kubectl-object-model';

export async function deploy(ignoreSslErrors?: boolean) {
    TaskInputParameters.validateCanaryPercentage();
    TaskInputParameters.validateReplicaCount();
    TaskInputParameters.validateTimeoutForRolloutStatus();
    const kubectlPath = await utils.getKubectl();
    const kubectl = new Kubectl(kubectlPath, TaskInputParameters.namespace, ignoreSslErrors);
    await deploymentHelper.deploy(kubectl, TaskInputParameters.manifests, TaskInputParameters.deploymentStrategy);
}