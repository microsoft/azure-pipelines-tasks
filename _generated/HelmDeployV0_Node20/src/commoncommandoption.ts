"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "./helmcli";

export function addArguments(helmCli: helmcli) : void {
    var tillernamespace = tl.getInput("tillernamespace", false);
    var debugMode = tl.getVariable('system.debug');

    if(tillernamespace) {
        helmCli.addArgument("--tiller-namespace ".concat(tillernamespace));
    }

    if(debugMode === 'true') {
        helmCli.addArgument("--debug");
    }
}