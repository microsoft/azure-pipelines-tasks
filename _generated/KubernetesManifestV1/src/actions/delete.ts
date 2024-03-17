'use strict';

import * as tl from 'azure-pipelines-task-lib/task';
import { Kubectl } from 'azure-pipelines-tasks-kubernetes-common/kubectl-object-model';
import * as utils from '../utils/utilities';
import * as TaskInputParameters from '../models/TaskInputParameters';

export async function deleteResources(ignoreSslErrors?: boolean) {
    const args = TaskInputParameters.args;

    if (args == null || args.length === 0) {
        throw (tl.loc('ArgumentsInputNotSupplied'));
    }

    const kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace, ignoreSslErrors);
    const result = kubectl.delete(args);
    utils.checkForErrors([result]);
}