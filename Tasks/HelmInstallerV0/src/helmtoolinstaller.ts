"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');

import * as toolLib from 'vsts-task-tool-lib/tool';
import * as kubectlinstaller from "./kubectlinstaller"
import * as helminstaller from "./helminstaller"

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

async function configureKubectl() {
    var version = await kubectlinstaller.getKuberctlVersion();
    var kubectlPath = await kubectlinstaller.downloadKubectl(version);

    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].startsWith(path.dirname(kubectlPath))) {
        toolLib.prependPath(path.dirname(kubectlPath));
    }
}

async function configureHelm() {
    var version = await helminstaller.getHelmVersion();
    var helmPath = await helminstaller.downloadHelm(version);

    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].startsWith(path.dirname(helmPath))) {
        toolLib.prependPath(path.dirname(helmPath));
    }
}

async function verifyHelm() {
    console.log(tl.loc("VerifyHelmInstallation"));
    var helmToolPath = tl.which("helm", true);
    var helmTool = tl.tool(helmToolPath);
    helmTool.arg("init");
    helmTool.arg("--client-only");
    return helmTool.exec()
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