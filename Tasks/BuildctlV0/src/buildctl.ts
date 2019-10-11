"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import utils = require("./utils");


tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

async function configureBuildctl() {
    var stableBuildKitVersion = await utils.getBuildctlVersion();
    var buildctlPath = await utils.downloadBuildctl(stableBuildKitVersion);

    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].startsWith(path.dirname(buildctlPath))) {
        toolLib.prependPath(path.dirname(buildctlPath));
    }
}

async function verifyBuildctl() {
    tl.debug(tl.loc("VerifyBuildctlInstallation"));
    var buildctlToolPath = tl.which("buildctl", true);
    var buildctlTool = tl.tool(buildctlToolPath);
    buildctlTool.arg("--help");
    buildctlTool.exec();
}
    
async function buildContainer() {
    if(process.env["RUNNING_AS_K8_POOLPROVIDER"] == "1") {
        tl.debug("Container building using buildctl");
        return buildUsingBuildctl();
    }
    else {
        tl.debug("Container building using docker frontend");
        return buildUsingDocker();
    }

}

async function buildUsingBuildctl() {

    await verifyBuildctl();
    const dockerfilepath = tl.getInput("dockerFile", true);
    const contextpath = tl.getInput("localContext", true);
    var podname = await utils.getBuildKitPod();
    tl.debug("Podname " +podname);
    process.env["BUILDKIT_HOST"] = "kube-pod://"+podname+"?namespace=azuredevops";
    var buildctlToolPath = tl.which("buildctl", true);
    var buildctlTool = tl.tool(buildctlToolPath);
    buildctlTool.arg("build");
    buildctlTool.arg('--frontend=dockerfile.v0');
        
    var contextarg = "--local=context="+contextpath;
    var dockerfilearg = "--local=dockerfile="+dockerfilepath;
    buildctlTool.arg(contextarg);
    buildctlTool.arg(dockerfilearg);
    return buildctlTool.exec();
}

async function buildUsingDocker() {

    const dockerfilepath = tl.getInput("dockerFile", true);
    const contextpath = tl.getInput("localContext", true);
    var dockerToolPath = tl.which("docker", true);
    var command = tl.tool(dockerToolPath);
    command.arg("build");
    command.arg(["-f", dockerfilepath]);

    command.arg(contextpath);

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    let dockerHostVar = tl.getVariable("DOCKER_HOST");
    if (dockerHostVar) {
        tl.debug(tl.loc('ConnectingToDockerHost', dockerHostVar));
    }
    return command.exec();
}

configureBuildctl()
    .then(() => buildContainer())
    .then(() => {
        tl.setResult(tl.TaskResult.Succeeded, "");
    }).catch((error) => {
        tl.setResult(tl.TaskResult.Failed, error)
    });