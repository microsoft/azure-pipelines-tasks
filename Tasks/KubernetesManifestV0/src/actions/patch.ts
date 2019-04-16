"use strict";

import tl = require('vsts-task-lib/task');
import { Kubectl } from "kubernetes-common/kubectl-object-model";
import * as utils from "../utils/utilities";
import * as constants from "../models/constants";

export async function patch() {
    let kubectl = new Kubectl(await utils.getKubectl(), tl.getInput("namespace", false));
    let kind = tl.getInput("kind", false).toLowerCase();
    let name = tl.getInput("name", false);
    let filePath = tl.getInput("resourceFileToPatch", false);
    let strategy = tl.getInput("mergeStrategy", false);
    let patch = tl.getInput("patch", true);
    if (tl.filePathSupplied("resourceFileToPatch") && tl.getInput("resourceToPatch") == "file") {
        kind = "-f";
        name = filePath;
    }

    let result = kubectl.patch(kind, name, patch, strategy);
    utils.checkForErrors([result]);
    let resources = kubectl.getResources(result.stdout, ["deployment", "replicaset", "daemonset", "pod", "statefulset"]);

    resources.forEach(resource => {
        utils.checkForErrors([kubectl.checkRolloutStatus(resource.type, resource.name)]);
        utils.checkForErrors([kubectl.annotate(resource.type, resource.name, constants.pipelineAnnotations, true)]);
        utils.checkForErrors(utils.annotateChildPods(kubectl, resource.type, resource.name, JSON.parse((kubectl.getAllPods()).stdout)));
    });
}