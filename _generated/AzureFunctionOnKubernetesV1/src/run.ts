"use strict";

import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { deploy } from './deploy';
import { DockerConnection } from './dockerConnection';
import { CommandHelper } from './utils/commandHelper';

import ClusterConnection from "./clusterconnection";

import trm = require('azure-pipelines-task-lib/toolrunner');

tl.setResourcePath(path.join(__dirname, "..", 'task.json'));

let telemetry = {
    jobId: tl.getVariable('SYSTEM_JOBID')
};

console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
    "TaskEndpointId",
    "AzureFunctionOnKubernetesV0",
    JSON.stringify(telemetry));

async function run() {
    const kubernetesConnection = new ClusterConnection();
    const commandHelper = new CommandHelper();
    const dockerConnection = new DockerConnection();
    console.log("Opening docker connection...");
    await dockerConnection.open();
    console.log("Opening kubernetes connection...");
    await kubernetesConnection.open();

    try {
        console.log("Trying to deploy...")
        await deploy(commandHelper, dockerConnection);
    }
    finally {
        console.log("Closing docker connection...");
        dockerConnection.close();
        console.log("Closing kubernetes connection...");
        kubernetesConnection.close();
    }
}

run()
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));