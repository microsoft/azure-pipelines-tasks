"use strict";

import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as utils from './utils';

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

let telemetry = {
    jobId: tl.getVariable('SYSTEM_JOBID')
};

console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
    "TaskEndpointId",
    "FuncToolsInstallerV0",
    JSON.stringify(telemetry));

async function downloadFuncTools() {
    const version = await utils.getFuncToolsVersion();
    const funcToolsPath = await utils.downloadFuncTools(version);

    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].startsWith(path.dirname(funcToolsPath))) {
        toolLib.prependPath(path.dirname(funcToolsPath));
    }
}

async function verifyFuncTools() {
    console.log(tl.loc("VerifyingFuncToolsInstallation"));
    const funcToolsPath = tl.which("func", true);
    var func = tl.tool(funcToolsPath);
    func.arg("--version");
    return func.exec();
}

downloadFuncTools()
    .then(() => verifyFuncTools())
    .then(() => {
        tl.setResult(tl.TaskResult.Succeeded, "");
    }).catch((error) => {
        tl.setResult(tl.TaskResult.Failed, error)
    });