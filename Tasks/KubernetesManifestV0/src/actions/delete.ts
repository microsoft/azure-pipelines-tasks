"use strict";

import tl = require('vsts-task-lib/task');
import { Kubectl } from "kubernetes-common/kubectl-object-model";
import * as utils from "../utils/utilities";
import * as TaskInputParameters from '../models/TaskInputParameters';

export async function deleteResources() {
    let args = TaskInputParameters.args;

    if (args == null || args.length == 0) {
        throw (tl.loc("ArgumentsInputNotSupplied"));
    }

    let kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace);
    var result = kubectl.delete(args);
    utils.checkForErrors([result]);
}