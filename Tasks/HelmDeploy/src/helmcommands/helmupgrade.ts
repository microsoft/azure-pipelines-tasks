"use strict";

import tl = require('vsts-task-lib/task');
import helmcli from "./../helmcli";
import * as helmutil from "./../utils";
import {addHelmTlsSettings} from "./../tlssetting";

export function addArguments(helmCli: helmcli) : void {
    var chartType = tl.getInput("chartType", true);
    var releaseName = tl.getInput("releaseName", false);
    var overrideValues = tl.getInput("overrideValues", false);
    var namespace = tl.getInput("namespace", false);

    var waitForExecution = tl.getBoolInput('waitForExecution', false);
    var argumentsInput = tl.getInput("arguments", false);
    var valueFile = tl.getInput("valueFile", false);
    var install = tl.getBoolInput("install", false);
    var recreate = tl.getBoolInput("recreate", false);
    var resetValues = tl.getBoolInput("resetValues", false);
    var force = tl.getBoolInput("force", false);
    var enableTls = tl.getBoolInput("enableTls", false);
    var rootFolder = tl.getVariable('System.DefaultWorkingDirectory');

    if(namespace) {
        helmCli.addArgument("--namespace ".concat(namespace));
    }

    if(install) {
        helmCli.addArgument("--install");
    }

    if(recreate) {
        helmCli.addArgument("--recreate-pods");
    }

    if(resetValues) {
        helmCli.addArgument("--reset-values");
    }

    if(force) {
        helmCli.addArgument("--force");
    }

    if(valueFile && valueFile != rootFolder) {
        helmCli.addArgument("--values");
        helmCli.addArgument("\"" + helmutil.resolvePath(valueFile) + "\"");
    }
    
    if(overrideValues) {
        helmCli.addArgument("--set ".concat(overrideValues));   
    }

    if(waitForExecution) {
        helmCli.addArgument("--wait");
    }

    if(enableTls) {
        addHelmTlsSettings(helmCli);
    }

    if(argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }

    if(releaseName) {
        helmCli.addArgument(releaseName);
    }

    if(chartType === "Name") {
        var chartName = tl.getInput("chartName", true);
        helmCli.addArgument(chartName);

    }
    else {
        var chartPath = tl.getInput("chartPath", true);
        helmCli.addArgument("\"" + helmutil.resolvePath(chartPath)+ "\"");
    }
}