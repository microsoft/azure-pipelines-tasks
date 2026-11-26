"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "../helmcli";
import * as helmutil from "../utils";

export async function addArguments(helmCli: helmcli) : Promise<void>  {

    var releaseName = helmutil.trimIdentifierInput(tl.getInput("releaseName", true));
    var namespace = helmutil.trimIdentifierInput(tl.getInput("namespace", true));

    helmCli.addSingleArgument(helmutil.validateReleaseName(releaseName));

    if (namespace) {
        helmCli.addSingleArgument("--namespace");
        helmCli.addSingleArgument(namespace);
    }
}