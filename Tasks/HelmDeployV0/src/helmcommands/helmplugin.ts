"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "./../helmcli";

export function addArguments(helmCli: helmcli) : void { 

    var pluginCommand = tl.getInput("pluginCommand", true);
    var argumentsInput = tl.getInput("arguments", false);

    if (pluginCommand != "run"){
        helmCli.addArgument("plugin " + pluginCommand);
    }
    
    if(argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }

    var debugMode = tl.getVariable('system.debug');

    if(debugMode === 'true') {
        helmCli.addArgument("--debug");
    }
}