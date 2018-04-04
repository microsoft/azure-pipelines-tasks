"use strict";

import tl = require('vsts-task-lib/task');
import helmcli from "./../helmcli";
import * as helmutil from "./../utils";

export function addArguments(helmCli: helmcli) : void { 

    var chart = tl.getInput("chartPath", true);
    var version = tl.getInput("version", false);
    var updatedependency = tl.getBoolInput('updatedependency', false);
    var destination = tl.getInput("destination", false);
    var save = tl.getBoolInput('save', false);
    var argumentsInput = tl.getInput("arguments", false);

    if(updatedependency) {
        helmCli.addArgument("--dependency-update");
    }

    if(save) {
        helmCli.addArgument("--save ");
    }

    if(version) {
        helmCli.addArgument("--version ".concat(version));
    }

    if(destination) {
        helmCli.addArgument("--destination \"" + destination + "\"");
    }

    if(argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }


    helmCli.addArgument("\"" + helmutil.resolvePath(chart) + "\"");
    
}