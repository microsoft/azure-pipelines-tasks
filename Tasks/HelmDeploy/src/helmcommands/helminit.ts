"use strict";

import tl = require('vsts-task-lib/task');
import helmcli from "./../helmcli";

export function addArguments(helmCli: helmcli) : void {
    var waitForTiller = tl.getBoolInput('waitForExecution', false);
    var canaryimage = tl.getBoolInput('canaryimage', false);
    var upgradeTiller = tl.getBoolInput('upgradetiller', false);
    var argumentsInput = tl.getInput("arguments", false)
    
    if(canaryimage) {
        helmCli.addArgument("--canary-image");
    }

    if(upgradeTiller) {
        helmCli.addArgument("--upgrade");
    }

    if(waitForTiller) {
        helmCli.addArgument("--wait");
    }

    if(argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }
}