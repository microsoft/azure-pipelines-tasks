'use strict';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as path from 'path';
import utils = require('./utils');

taskLib.setResourcePath(path.join(__dirname, '..', 'task.json'));

async function configureOpa() {
    const version = await utils.getOpaVersion();
    const opaPath = await utils.downloadOpa(version);

    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].startsWith(path.dirname(opaPath))) {
        toolLib.prependPath(path.dirname(opaPath));
    }
}

function verifyOpa() {
    console.log(taskLib.loc('VerifyOpaInstallation'));
    const opaToolPath = taskLib.which('opa', true);
    const opaTool = taskLib.tool(opaToolPath);
    opaTool.arg('version');
    return opaTool.exec();
}

configureOpa()
    .then(() => verifyOpa())
    .then(() => taskLib.setResult(taskLib.TaskResult.Succeeded, ''))
    .catch((error) => taskLib.setResult(taskLib.TaskResult.Failed, error));