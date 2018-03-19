"use strict";

import tl = require('vsts-task-lib/task');
import helmcli from "./../helmcli";

export function addArguments(helmCli: helmcli) : void { 
    var chart = tl.getInput("chart", false);
    var version = tl.getInput("version", false);
    var releaseName = tl.getInput("releaseName", false);
    var overrideValues = tl.getInput("overrideValues", false);

    var updatedependency = tl.getBoolInput('updatedependency', false);
    var waitForTiller = tl.getBoolInput('waitForExecution', false);
    var argumentsInput = tl.getInput("arguments", false);

    if(version) {
        helmCli.addArgument("--version ".concat(version));
    }

    if(releaseName) {
        helmCli.addArgument("--name ".concat(releaseName));
    }

    if(overrideValues) {
        helmCli.addArgument("--set ".concat(overrideValues));
    }

    if(updatedependency) {
        helmCli.addArgument("--dep-up");
    }

    if(waitForTiller) {
        helmCli.addArgument("--wait");
    }

    if(argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }

    helmCli.addArgument(chart);
}