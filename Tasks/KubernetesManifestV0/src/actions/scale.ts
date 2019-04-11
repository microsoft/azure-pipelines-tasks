"use strict";

import tl = require('vsts-task-lib/task');
import { Kubectl } from "kubernetes-common/kubectl-object-model";
import * as utils from "../utils/utilities";
import * as constants from "../models/constants";

export async function scale() {
    let kubectl = new Kubectl(await utils.getKubectl(), tl.getInput("namespace", false));
    let kind = tl.getInput("kind", true).toLowerCase();
    let replicas = tl.getInput("replicas", true);
    let name = tl.getInput("name", true);
    let result = kubectl.scale(kind, name, replicas);
    utils.checkForErrors([result]);
    utils.checkForErrors([kubectl.checkRolloutStatus(kind, name)]);
    utils.checkForErrors([kubectl.annotate(kind, name, constants.pipelineAnnotations, true)]);
    utils.checkForErrors(utils.annotateChildPods(kubectl, kind, name, JSON.parse((kubectl.getAllPods()).stdout)));
}