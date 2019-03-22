"use strict";

import * as deploymentHelper from '../utils/DeploymentHelper';
import * as TaskInputParameters from '../models/TaskInputParameters';
import * as utils from "../utils/utilities";
import { Kubectl } from "utility-common/kubectl-object-model";

export async function deploy() {
    let kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace);
    deploymentHelper.deploy(kubectl, TaskInputParameters.manifests);
}