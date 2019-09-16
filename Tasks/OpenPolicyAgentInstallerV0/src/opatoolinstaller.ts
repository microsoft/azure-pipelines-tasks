'use strict';
import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import utils = require("./utils");

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

async function configureOpa() {
    var version = await utils.getOpaVersion();
    var opaPath = await utils.downloadOpa(version);

    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].startsWith(path.dirname(opaPath))) {
        toolLib.prependPath(path.dirname(opaPath));
    }
}

async function verifyOpa() {
    console.log(tl.loc("VerifyOpaInstallation"));
    var opaToolPath = tl.which("opa", true);
    var opaTool = tl.tool(opaToolPath);
    opaTool.arg("version");
    return opaTool.exec();
}

configureOpa()
    .then(() => verifyOpa())
    .then(() => {
        tl.setResult(tl.TaskResult.Succeeded, "");
    }).catch((error) => {
        tl.setResult(tl.TaskResult.Failed, error);
    });