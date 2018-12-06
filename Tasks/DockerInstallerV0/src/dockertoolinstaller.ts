"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');

import * as toolLib from 'vsts-task-tool-lib/tool';
import * as dockerInstaller from "./dockerinstaller";

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

async function configureDocker() {
    var version = tl.getInput("dockerVersion", true);
    var releaseType = tl.getInput("releaseType", true);

    var dockerPath = await dockerInstaller.downloadDocker(version, releaseType);

    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].startsWith(path.dirname(dockerPath))) {
        toolLib.prependPath(path.dirname(dockerPath));
    }
}

async function verifyDocker() {
    console.log(tl.loc("VerifyDockerInstallation"));
    var dockerToolPath = tl.which("docker", true);
    var docker = tl.tool(dockerToolPath);
    docker.arg("--version");
    return docker.exec();
}

configureDocker()
    .then(() => verifyDocker())
    .then(() => {
        tl.setResult(tl.TaskResult.Succeeded, "");
    }).catch((error) => {
        tl.setResult(tl.TaskResult.Failed, error)
    });
