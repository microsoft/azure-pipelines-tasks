'use strict';

import * as tl from 'azure-pipelines-task-lib/task';
import { Kubectl } from 'azure-pipelines-tasks-kubernetes-common/kubectl-object-model';
import * as utils from '../utils/utilities';
import * as constants from 'azure-pipelines-tasks-kubernetes-common/kubernetesconstants';
import * as TaskParameters from '../models/TaskInputParameters';

export async function patch(ignoreSslErrors?: boolean) {
    TaskParameters.validateTimeoutForRolloutStatus();
    const kubectl = new Kubectl(await utils.getKubectl(), TaskParameters.namespace, ignoreSslErrors);
    let kind = tl.getInput('kind', false);
    if(kind)
        kind = kind.toLowerCase();
    let name = tl.getInput('name', false);
    const filePath = tl.getInput('resourceFileToPatch', false);
    const strategy = tl.getInput('mergeStrategy', false);
    const patch = tl.getInput('patch', true);
    if (tl.filePathSupplied('resourceFileToPatch') && tl.getInput('resourceToPatch') === 'file') {
        kind = '-f';
        name = filePath;
    }

    const result = kubectl.patch(kind, name, patch, strategy);
    utils.checkForErrors([result]);
    const resources = kubectl.getResources(result.stdout, ['deployment', 'replicaset', 'daemonset', 'pod', 'statefulset']);

    resources.forEach(resource => {
        utils.checkForErrors([kubectl.checkRolloutStatus(resource.type, resource.name, TaskParameters.rolloutStatusTimeout)]);
        utils.checkForErrors([kubectl.annotate(resource.type, resource.name, constants.pipelineAnnotations, true)]);
        utils.checkForErrors(utils.annotateChildPods(kubectl, resource.type, resource.name, JSON.parse((kubectl.getAllPods()).stdout)));
    });
}