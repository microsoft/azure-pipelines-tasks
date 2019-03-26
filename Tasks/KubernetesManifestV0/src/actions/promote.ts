"use strict";
import tl = require('vsts-task-lib/task');
import * as deploymentHelper from '../utils/DeploymentHelper';
import * as canaryDeploymentHelper from '../utils/CanaryDeploymentHelper';
import { Kubectl } from "utility-common/kubectl-object-model";
import * as utils from "../utils/utilities";
import * as TaskInputParameters from '../models/TaskInputParameters';

export async function promote() {

    let kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace);

    // Deploy input manifests
    tl.debug("Deploying input manifests");
    deploymentHelper.deploy(kubectl, TaskInputParameters.manifests, "None");

    // delete canary deployment if strategy is canary
    if (canaryDeploymentHelper.isCanaryDeploymentStrategy()) {
        tl.debug("Deployment strategy selected is Canary. Deleting canary and baseline workloads.");
        canaryDeploymentHelper.deleteCanaryDeployment(kubectl, TaskInputParameters.manifests);
    }
}