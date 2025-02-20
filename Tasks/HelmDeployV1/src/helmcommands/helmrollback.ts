"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "../helmcli";

export async function addArguments(helmCli: helmcli) : Promise<void>  {

    var releaseName = tl.getInput("releaseName", true);
    var namespace = tl.getInput("namespace", true);

    helmCli.addArgument(releaseName);

    if (namespace) {
        helmCli.addArgument("--namespace ".concat(namespace));
    }
}