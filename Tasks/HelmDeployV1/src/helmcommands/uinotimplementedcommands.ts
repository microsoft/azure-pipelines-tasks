"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "./../helmcli";
import {addHelmTlsSettings} from "./../tlssetting";
import * as helmutil from "./../utils";

export async function addArguments(helmCli: helmcli) : Promise<void> {
    var namespace = helmutil.trimIdentifierInput(tl.getInput("namespace", false));
    var argumentsInput = tl.getInput("arguments", false)
    var enableTls = tl.getBoolInput("enableTls", false);

    if(namespace) {
        helmCli.addSingleArgument("--namespace");
        helmCli.addSingleArgument(namespace);
    }

    if(enableTls) {
        addHelmTlsSettings(helmCli);
    }

    if(argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }
}