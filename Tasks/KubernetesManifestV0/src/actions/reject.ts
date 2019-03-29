"use strict";
import tl = require('vsts-task-lib/task');
import * as canaryDeploymentHelper from '../utils/CanaryDeploymentHelper';
import { Kubectl } from "kubernetes-common/kubectl-object-model";
import * as utils from "../utils/utilities";
import * as TaskInputParameters from '../models/TaskInputParameters';

export async function reject() {

    let kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace);

    if (canaryDeploymentHelper.isCanaryDeploymentStrategy()) {
        tl.debug("Deployment strategy selected is Canary. Deleting baseline and canary workloads.");
        canaryDeploymentHelper.deleteCanaryDeployment(kubectl, TaskInputParameters.manifests);
    }
    else {
        tl.debug("Strategy is not canary deployment. Invalid request.");
        throw (tl.loc("InvalidRejectActionDeploymentStrategy"));
    }
}