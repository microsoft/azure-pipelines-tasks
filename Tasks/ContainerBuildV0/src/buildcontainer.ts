"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import docker = require("./docker");
import buildctl = require("./buildctl");

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

async function buildContainer() {
    if (process.env["RUNNING_ON"] == "KUBERNETES") {
        tl.debug("Building image using buildctl");
        return buildctl.buildctlBuildAndPush();
    }
    else {
        tl.debug("Building image using docker");
        return docker.dockerBuildAndPush();
    }
}

buildContainer()
    .then(() => {
        tl.setResult(tl.TaskResult.Succeeded, "");
    }).catch((error) => {
        tl.setResult(tl.TaskResult.Failed, error)
    });