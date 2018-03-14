"use strict";

import tl = require('vsts-task-lib/task');
import helmcli from "./helmcli";

export function addArguments(helmCli: helmcli) : void {
    var namespace = tl.getInput("namespace", false);
    var argumentsInput = tl.getInput("arguments", false)

    if(namespace) {
        helmCli.addArgument("--namespace ".concat(namespace));
    }

    if(argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }
}