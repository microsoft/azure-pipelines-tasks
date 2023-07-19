"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "../helmcli";

/*
Removes a helm chart from local
 */

export function addArguments(helmCli: helmcli): void {
    helmCli.addArgument("remove");

    helmCli.addArgument(tl.getVariable("helmChartRef"));
}