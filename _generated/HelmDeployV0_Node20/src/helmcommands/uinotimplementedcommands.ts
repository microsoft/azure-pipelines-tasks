"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "./../helmcli";
import {addHelmTlsSettings} from "./../tlssetting";

export function addArguments(helmCli: helmcli) : void {
    var namespace = tl.getInput("namespace", false);
    var argumentsInput = tl.getInput("arguments", false)
    var enableTls = tl.getBoolInput("enableTls", false);

    if(namespace) {
        helmCli.addArgument("--namespace ".concat(namespace));
    }

    if(enableTls) {
        addHelmTlsSettings(helmCli);
    }

    if(argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }
}