"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "../helmcli";
import * as helmutil from "../utils";

/*
Pushes a helm chart to ACR
*/

export async function addArguments(helmCli: helmcli): Promise<void> {
    helmCli.setCommand("push");

    helmCli.addSingleArgument(tl.getVariable("helmChartRef"));
    helmCli.addSingleArgument(tl.getInput("chartPath" , true));
    helmCli.addSingleArgument(helmutil.validateChartReference(tl.getInput("remoteRepo" , true)));
}