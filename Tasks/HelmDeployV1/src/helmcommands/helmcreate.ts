"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "./../helmcli";

export async function addArguments(helmCli: helmcli) : Promise<void>  {

    var chartName = tl.getInput("chartName", true);

    helmCli.addArgument(chartName);
}