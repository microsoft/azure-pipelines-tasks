"use strict";
import tl = require('vsts-task-lib/task');
import * as deploymentHelper from '../utils/DeploymentHelper';
import * as canaryDeploymentHelper from '../utils/CanaryDeploymentHelper';
import { Kubectl } from "kubernetes-common/kubectl-object-model";
import * as utils from "../utils/utilities";
import * as TaskInputParameters from '../models/TaskInputParameters';

export async function promote() {

    let kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace);

    if (canaryDeploymentHelper.isCanaryDeploymentStrategy()) {
        // Deploy input manifests
        tl.debug("Deploying input manifests");
        deploymentHelper.deploy(kubectl, TaskInputParameters.manifests, "None");
        tl.debug("Deployment strategy selected is Canary. Deleting canary and baseline workloads.");
        try {
            canaryDeploymentHelper.deleteCanaryDeployment(kubectl, TaskInputParameters.manifests);
        } catch (ex) {
            tl.warning("Exception occurred while deleting canary and baseline workloads. Exception: " + ex);
        }
    }
    else {
        tl.debug("Strategy is not canary deployment. Invalid request.");
        throw (tl.loc("InvalidPromotetActionDeploymentStrategy"));
    }
}