"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "./helmcli";

export function addArguments(helmCli: helmcli) : void {
    var tillernamespace = tl.getInput("tillernamespace", false);
    var debugMode = tl.getVariable('system.debug');

    if(tillernamespace) {
        // --tiller-namespace flag only exists in Helm v2, not in v3+
        if (!helmCli.isHelmV3orHigher()) {
            helmCli.addArgument("--tiller-namespace ".concat(tillernamespace));
        } else {
            tl.warning("The 'tillernamespace' parameter is ignored in Helm v3 and higher as Tiller has been removed.");
        }
    }

    if(debugMode === 'true') {
        helmCli.addArgument("--debug");
    }
}