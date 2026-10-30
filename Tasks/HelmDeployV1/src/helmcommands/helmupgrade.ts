"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "./../helmcli";
import * as helmutil from "./../utils";
import { addHelmTlsSettings } from "./../tlssetting";
import * as semver from 'semver';

export async function addArguments(helmCli: helmcli): Promise<void> {
    var chartType = tl.getInput("chartType", true);
    var releaseName = helmutil.trimIdentifierInput(tl.getInput("releaseName", false));
    var overrideValues = tl.getInput("overrideValues", false);
    var namespace = helmutil.trimIdentifierInput(tl.getInput("namespace", false));

    var waitForExecution = tl.getBoolInput('waitForExecution', false);
    var argumentsInput = tl.getInput("arguments", false);
    var valueFile = tl.getInput("valueFile", false);
    var install = tl.getBoolInput("install", false);
    var recreate = tl.getBoolInput("recreate", false);
    var resetValues = tl.getBoolInput("resetValues", false);
    var force = tl.getBoolInput("force", false);
    var enableTls = tl.getBoolInput("enableTls", false);
    var rootFolder = tl.getVariable('System.DefaultWorkingDirectory');
    var version = tl.getInput("version", false);

    if (!releaseName) {
        var hostType = tl.getVariable("SYSTEM_HOSTTYPE");
        releaseName = helmutil.trimIdentifierInput((hostType === "build") ? tl.getVariable("BUILD_BUILDNUMBER") : tl.getVariable("RELEASE_RELEASENAME"));
    }

    if (namespace) {
        helmCli.addSingleArgument("--namespace");
        helmCli.addSingleArgument(namespace);
    }

    if (install) {
        helmCli.addArgument("--install");
    }

    if (recreate) {
        helmCli.addArgument("--recreate-pods");
    }

    if (resetValues) {
        helmCli.addArgument("--reset-values");
    }

    if (force) {
        helmCli.addArgument("--force");
    }

    if (valueFile && valueFile != rootFolder) {
        helmCli.addSingleArgument("--values");
        helmCli.addSingleArgument(helmutil.resolvePath(valueFile));
    }

    if (overrideValues) {
        helmCli.addArgument("--set ".concat(helmutil.replaceNewlinesWithCommas(overrideValues)));
    }

    if (waitForExecution) {
        helmCli.addArgument("--wait");
    }

    if (enableTls) {
        addHelmTlsSettings(helmCli);
    }

    if (argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }

    if (releaseName) {
        helmCli.addSingleArgument(releaseName);
    }

    if (chartType === "Name") {
        var chartName = helmutil.trimIdentifierInput(tl.getInput("chartName", true));
        helmCli.addSingleArgument(chartName);
    }
    else {
        var chartPath = tl.getInput("chartPath", true);
        helmCli.addSingleArgument(helmutil.resolvePath(chartPath));
    }

    if (version) {
        if (semver.valid(version)) {
            helmCli.addSingleArgument("--version");
            helmCli.addSingleArgument(version);
        } else {
            tl.debug("The given version " + version + " is not valid. Running the helm upgrade command with latest version");
        }
    }
}