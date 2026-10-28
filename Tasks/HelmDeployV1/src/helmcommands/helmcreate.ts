"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "./../helmcli";
import * as helmutil from "./../utils";

export async function addArguments(helmCli: helmcli) : Promise<void>  {

    var chartName = helmutil.trimIdentifierInput(tl.getInput("chartName", true));

    helmCli.addSingleArgument(chartName);
}