'use strict';

import * as tl from 'azure-pipelines-task-lib/task';

import * as utils from '../utils/utilities';
import * as constants from 'kubernetes-common-v2/kubernetesconstants';
import * as TaskInputParameters from '../models/TaskInputParameters';

import { Kubectl } from 'kubernetes-common-v2/kubectl-object-model';

export async function scale(ignoreSslErrors?: boolean) {
    const kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace, ignoreSslErrors);
    const kind = tl.getInput('kind', true).toLowerCase();
    const replicas = tl.getInput('replicas', true);
    const name = tl.getInput('name', true);
    const result = kubectl.scale(kind, name, replicas);
    utils.checkForErrors([result]);
    utils.checkForErrors([kubectl.checkRolloutStatus(kind, name)]);
    utils.checkForErrors([kubectl.annotate(kind, name, constants.pipelineAnnotations, true)]);
    utils.checkForErrors(utils.annotateChildPods(kubectl, kind, name, JSON.parse((kubectl.getAllPods()).stdout)));
}