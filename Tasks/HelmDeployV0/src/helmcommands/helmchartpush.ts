"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "../helmcli";

/*
Pushes a helm chart to ACR
*/

export function addArguments(helmCli: helmcli): void {
    helmCli.addArgument("push");

    helmCli.addArgument(tl.getVariable("helmChartRef"));
}