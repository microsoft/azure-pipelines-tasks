"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "./../helmcli";
import * as helmutil from "./../utils";

export function addArguments(helmCli: helmcli): void {

    var chart = tl.getInput("chartPath", true);
    var version = tl.getInput("version", false);
    var updatedependency = tl.getBoolInput('updatedependency', false);
    var destination = tl.getInput("destination", false);
    var save = tl.getBoolInput('save', false);
    var argumentsInput = tl.getInput("arguments", false);

    if (save && !helmCli.isHelmV3()) {
        helmCli.addArgument("--save ");
    }

    //Version check for Helm, as --dep-up was renamed to --dependency-update in Helm 3
    if (updatedependency) {
        if (helmCli.isHelmV3()) {
            helmCli.addArgument("--dependency-update");
        }
        else {
            helmCli.addArgument("--dep-up");
        }
    }

    if (version) {
        helmCli.addArgument("--version ".concat(version));
    }

    if (destination) {
        if (!tl.exist(destination)) {
            tl.mkdirP(destination);
        }
        helmCli.addArgument("--destination \"" + destination + "\"");
    }

    if (argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }


    helmCli.addArgument("\"" + helmutil.resolvePath(chart) + "\"");

}
