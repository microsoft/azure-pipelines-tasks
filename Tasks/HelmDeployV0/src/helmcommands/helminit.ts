"use strict";

import tl = require('vsts-task-lib/task');
import helmcli from "./../helmcli";
import {addTillerTlsSettings} from "./../tlssetting";

export function addArguments(helmCli: helmcli) : void {
    var waitForTiller = tl.getBoolInput('waitForExecution', false);
    var canaryimage = tl.getBoolInput('canaryimage', false);
    var upgradeTiller = tl.getBoolInput('upgradetiller', false);
    var argumentsInput = tl.getInput("arguments", false);
    var enableTls = tl.getBoolInput("enableTls", false);
    
    if(canaryimage) {
        helmCli.addArgument("--canary-image");
    }

    if(upgradeTiller) {
        helmCli.addArgument("--upgrade");
    }

    if(waitForTiller) {
        helmCli.addArgument("--wait");
    }

    if(enableTls) {
        addTillerTlsSettings(helmCli);
    }

    if(argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }
}