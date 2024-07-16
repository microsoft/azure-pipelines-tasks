"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');

import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as utils from "./utils";

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

async function configureDocker() {
    var version = tl.getInput("dockerVersion", true);
    var releaseType = tl.getInput("releaseType", true);

    var dockerPath = await utils.downloadDocker(version, releaseType);

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
    .then(() => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((error) => tl.setResult(tl.TaskResult.Failed, error));
