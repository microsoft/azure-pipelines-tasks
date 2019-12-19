"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "./../helmcli";
import * as helmutil from "./../utils";


export function addArguments(helmCli: helmcli) : void { 
    var chart = tl.getInput("chartPath", true);
    var overrideValues = tl.getInput("overrideValues", false);
    var namespace = tl.getInput("namespace", false);
    var argumentsInput = tl.getInput("arguments", false);
    var valueFile = tl.getInput("valueFile", false);
    var rootFolder = tl.getVariable('System.DefaultWorkingDirectory');

    if(namespace) {
        helmCli.addArgument("--namespace ".concat(namespace));
    }

    if(valueFile && valueFile != rootFolder) {
        helmCli.addArgument("--values");
        helmCli.addArgument("\"" + helmutil.resolvePath(valueFile)+ "\"");
    }

    if(overrideValues) {
        helmCli.addArgument("--set ".concat(overrideValues));
    }

    if(argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }

    helmCli.addArgument("\"" + helmutil.resolvePath(chart) + "\"");
}