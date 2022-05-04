"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "./../helmcli";
import * as helmutil from "./../utils";
import { addHelmTlsSettings } from "./../tlssetting";
import * as semver from 'semver';

/*supported chart install
By chart reference: helm install stable/mariadb
By path to a packaged chart: helm install ./nginx-1.2.3.tgz
By path to an unpacked chart directory: helm install ./nginx
By absolute URL: helm install https://example.com/charts/nginx-1.2.3.tgz

Not supported

chart reference and repo url: helm install –repo https://example.com/charts/ nginx

 */

export function addArguments(helmCli: helmcli): void {
    var chartType = tl.getInput("chartType", true);
    var releaseName = tl.getInput("releaseName", false);
    var overrideValues = tl.getInput("overrideValues", false);
    var namespace = tl.getInput("namespace", false);

    var updatedependency = tl.getBoolInput('updatedependency', false);
    var waitForExecution = tl.getBoolInput('waitForExecution', false);
    var argumentsInput = tl.getInput("arguments", false);
    var valueFile = tl.getInput("valueFile", false);
    var rootFolder = tl.getVariable('System.DefaultWorkingDirectory');
    var enableTls = tl.getBoolInput("enableTls", false);
    var version = tl.getInput('version', false);

    if (namespace) {
        helmCli.addArgument("--namespace ".concat(namespace));
    }

    if (valueFile && valueFile != rootFolder) {
        helmCli.addArgument("--values");
        helmCli.addArgument("\"" + helmutil.resolvePath(valueFile) + "\"");
    }

    if (overrideValues) {
        helmCli.addArgument("--set ".concat(helmutil.replaceNewlinesWithCommas(overrideValues)));
    }

    //Version check for Helm, as --name flag with install is no longer supported in Helm 3
    if (helmCli.isHelmV3()) {
        if (releaseName) {
            helmCli.addArgument(releaseName);
        }
        else {
            helmCli.addArgument('--generate-name');
        }
    }
    else if (releaseName) {
        helmCli.addArgument("--name ".concat(releaseName));
    }

    if (waitForExecution) {
        helmCli.addArgument("--wait");
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

    if (argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }

    if (enableTls) {
        addHelmTlsSettings(helmCli);
    }

    if (chartType === "Name") {
        var chartName = tl.getInput("chartName", true);
        helmCli.addArgument(chartName);

    }
    else {
        var chartPath = tl.getInput("chartPath", true);
        helmCli.addArgument("\"" + helmutil.resolvePath(chartPath) + "\"");
    }

    if (version) {
        if (semver.valid(version))
            helmCli.addArgument("--version ".concat(version));
        else
            console.log("The given version " + version + " is not valid. Running the helm install command with latest version");
    }
}
