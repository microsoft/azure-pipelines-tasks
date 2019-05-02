"use strict";

import * as deploymentHelper from '../utils/DeploymentHelper';
import * as TaskInputParameters from '../models/TaskInputParameters';
import * as utils from "../utils/utilities";
import { Kubectl } from "kubernetes-common/kubectl-object-model";

export async function deploy() {
    var kubectlPath = await utils.getKubectl();
    let kubectl = new Kubectl(kubectlPath, TaskInputParameters.namespace);
    deploymentHelper.deploy(kubectl, TaskInputParameters.manifests, TaskInputParameters.deploymentStrategy);
}