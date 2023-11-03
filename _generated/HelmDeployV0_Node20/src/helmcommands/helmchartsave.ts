"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "../helmcli";
import * as helmutil from "../utils";

/*
Saves a helm chart to local
*/

export function addArguments(helmCli: helmcli): void {
    helmCli.addArgument("save");

    var chartPath = tl.getInput("chartPathForACR", true);
    helmCli.addArgument(chartPath);

    helmCli.addArgument(helmutil.getHelmPathForACR());
}