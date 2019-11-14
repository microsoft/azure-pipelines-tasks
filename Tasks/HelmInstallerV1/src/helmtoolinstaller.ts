"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import * as toolLib from 'vsts-task-tool-lib/tool';
import utils = require("./utils");

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

var version = ""

async function configureHelm() {
    version = await utils.getHelmVersion();
    var helmPath = await utils.downloadHelm(version);
    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].startsWith(path.dirname(helmPath))) {
        toolLib.prependPath(path.dirname(helmPath));
    }
}

async function verifyHelm() {
    console.log(tl.loc("VerifyHelmInstallation"));
    var helmToolPath = tl.which("helm", true);
<<<<<<< HEAD
    var helmTool = tl.tool(helmToolPath);
<<<<<<< HEAD
    
    // Check if using Helm 2 or Helm 3
    if (helmVersion.startsWith("2")) {
=======
=======
>>>>>>> fixing for v2

    // Check if using Helm 2 or Helm 3
<<<<<<< HEAD
<<<<<<< HEAD
    if (helmVersion.startsWith("v2")) {
>>>>>>> Helm installer fix for v3
=======
    if (versionToInstall.startsWith("v2")) {
>>>>>>> Helm v3 fix refactor
=======
    if (version.startsWith("v2")) {
<<<<<<< HEAD
>>>>>>> Only check for v2
=======
        var helmTool = tl.tool(helmToolPath);
>>>>>>> fixing for v2
        helmTool.arg("init");
        helmTool.arg("--client-only");
        return helmTool.exec()
    }
}

configureHelm()
    .then(() => verifyHelm())
    .then(() => {
        tl.setResult(tl.TaskResult.Succeeded, "");
    }).catch((error) => {
        tl.setResult(tl.TaskResult.Failed, error)
    });