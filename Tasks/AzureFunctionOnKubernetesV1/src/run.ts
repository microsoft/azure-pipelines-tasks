"use strict";

import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { deploy } from './deploy';
import { DockerConnection } from './dockerConnection';
import { CommandHelper } from './utils/commandHelper';

import ClusterConnection from "./clusterconnection";

import trm = require('azure-pipelines-task-lib/toolrunner');

tl.setResourcePath(path.join(__dirname, "..", 'task.json'));
tl.setResourcePath(path.join(__dirname, '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/module.json'));
// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

let telemetry = {
    jobId: tl.getVariable('SYSTEM_JOBID')
};

console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
    "TaskEndpointId",
    "AzureFunctionOnKubernetesV1",
    JSON.stringify(telemetry));

async function run() {
    const kubernetesConnection = new ClusterConnection();
    displayKubectlVersion(kubernetesConnection);
    const commandHelper = new CommandHelper();
    const dockerConnection = new DockerConnection();
    await dockerConnection.open();
    await kubernetesConnection.open();

    try {
        await deploy(commandHelper, dockerConnection);
    }
    finally {
        dockerConnection.close();
        kubernetesConnection.close();
    }
}

function displayKubectlVersion(connection: ClusterConnection): void {
    try {
        var command = connection.createCommand();
        command.arg('version');
        command.arg(['-o', 'json']);
        const result = command.execSync({ silent: true } as trm.IExecOptions);
        const resultInJSON = JSON.parse(result.stdout);
        if (resultInJSON.clientVersion && resultInJSON.clientVersion.gitVersion) {
            console.log('==============================================================================');
            console.log('\t\t\t' + tl.loc('KubectlClientVersion') + ': ' + resultInJSON.clientVersion.gitVersion);
            if (resultInJSON.serverVersion && resultInJSON.serverVersion.gitVersion) {
                console.log('\t\t\t' + tl.loc('KubectlServerVersion') + ': ' + resultInJSON.serverVersion.gitVersion);
                console.log('==============================================================================');
            }
            else {
                console.log('\t' + tl.loc('KubectlServerVersion') + ': ' + tl.loc('KubectlServerVerisonNotFound'));
                console.log('==============================================================================');
                tl.debug(tl.loc('UnableToFetchKubectlVersion'));
            }
        }
    } catch (ex) {
            console.log(tl.loc('UnableToFetchKubectlVersion'));
    }
}

run()
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));