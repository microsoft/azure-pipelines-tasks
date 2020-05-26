"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "../helmcli";

/*
Saves a helm chart to ACR
 */

export function addArguments(helmCli: helmcli): void {
    helmCli.addArgument("save");

    var chartPath = tl.getInput("chartPath", true);
    helmCli.addArgument(chartPath);

    var chartName = tl.getInput("chartName", true);
    var acr = tl.getInput("azureContainerRegistry");
    helmCli.addArgument(acr+":"+chartName);

}