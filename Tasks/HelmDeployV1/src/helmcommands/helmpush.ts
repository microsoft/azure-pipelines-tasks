"use strict";

import tl = require('azure-pipelines-task-lib/task');
import helmcli from "./../helmcli";
import * as helmutil from "./../utils";

export async function addArguments(helmCli: helmcli): Promise<void> {

    var chartPathForACR = tl.getInput("chartPathForACR", true);
    var caFile = tl.getBoolInput('caFile', false);
    var certFile = tl.getBoolInput('certFile', false);
    var insecureSkipTlsVerify = tl.getBoolInput('insecureSkipTlsVerify', false);
    var keyFile = tl.getBoolInput('keyFile', false);
    var plainHttp = tl.getBoolInput('plainHttp', false);
    var argumentsInput = tl.getInput("arguments", false);

    if (caFile) {
        helmCli.addArgument("--ca-file");
    }

    if (certFile) {
        helmCli.addArgument("--cert-file");
    }

    if (insecureSkipTlsVerify) {
        helmCli.addArgument("--insecure-skip-tls-verify");
    }

    if (keyFile) {
        helmCli.addArgument("--key-file");
    }

    if (plainHttp) {
        helmCli.addArgument("--plain-http");
    }

    if (argumentsInput) {
        helmCli.addArgument(argumentsInput);
    }

    helmCli.addArgument(chartPathForACR);
    helmCli.addArgument("\"" + helmutil.getHelmPathForACR() + "\"");

}