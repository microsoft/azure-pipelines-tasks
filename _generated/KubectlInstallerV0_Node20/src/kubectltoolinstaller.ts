"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import utils = require("./utils");

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

async function configureKubectl() {
    var version = await utils.getKuberctlVersion();
    var kubectlPath = await utils.downloadKubectl(version);

    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].startsWith(path.dirname(kubectlPath))) {
        toolLib.prependPath(path.dirname(kubectlPath));
    }
}

async function verifyKubectl() {
    console.log(tl.loc("VerifyKubectlInstallation"));
    var kubectlToolPath = tl.which("kubectl", true);
    var kubectlTool = tl.tool(kubectlToolPath);
    kubectlTool.arg("--help");
    return kubectlTool.exec()
}

configureKubectl()
    .then(() => verifyKubectl())
    .then(() => {
        tl.setResult(tl.TaskResult.Succeeded, "");
    }).catch((error) => {
        tl.setResult(tl.TaskResult.Failed, error)
    });