"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "../helmcli";

/*
Removes a helm chart from local
 */

export async function addArguments(helmCli: helmcli): Promise<void> {
    helmCli.addArgument("remove");

    helmCli.addArgument(tl.getVariable("helmChartRef"));
}