"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "../helmcli";

export async function addArguments(helmCli: helmcli) : Promise<void>  {

    var releaseName = tl.getInput("releaseName", true);
    var namespace = tl.getInput("namespace", true);

    helmCli.addSingleArgument(releaseName);

    if (namespace) {
        helmCli.addSingleArgument("--namespace");
        helmCli.addSingleArgument(namespace);
    }
}