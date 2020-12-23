"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import fs = require('fs');

import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as kubectlinstaller from "./kubectlinstaller"
import * as helminstaller from "./helminstaller"

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

var helmVersion = ""

async function configureKubectl() {
    var version = await kubectlinstaller.getKuberctlVersion();
    var kubectlPath = await kubectlinstaller.downloadKubectl(version);

    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].startsWith(path.dirname(kubectlPath))) {
        toolLib.prependPath(path.dirname(kubectlPath));
    }
}

async function configureHelm() {
    helmVersion = await helminstaller.getHelmVersion();
    var helmPath = await helminstaller.downloadHelm(helmVersion);

    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].startsWith(path.dirname(helmPath))) {
        toolLib.prependPath(path.dirname(helmPath));
    }
}

async function verifyHelm() {
    console.log(tl.loc("VerifyHelmInstallation"));
    var helmToolPath = tl.which("helm", true);

    // Check if using Helm 2 or Helm 3
    if (helmVersion.startsWith("v2")) {
        var helmTool = tl.tool(helmToolPath);
        helmTool.arg("init");
        helmTool.arg("--client-only");
        helmTool.arg("--stable-repo-url");
        helmTool.arg("https://charts.helm.sh/stable");
        return helmTool.exec()
    }
}

configureHelm()
    .then(() => verifyHelm())
    .then(() => {
        if (tl.getBoolInput("installKubeCtl", true)) {
            return configureKubectl();
        }
    })
    .then(() => {
        tl.setResult(tl.TaskResult.Succeeded, "");
    }).catch((error) => {
        tl.setResult(tl.TaskResult.Failed, error)
    });