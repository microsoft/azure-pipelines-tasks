"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "../helmcli";

/*
Pushes a helm chart to ACR
*/

export async function addArguments(helmCli: helmcli): Promise<void> {
    helmCli.addArgument("push");

    helmCli.addArgument(tl.getVariable("helmChartRef"));
}