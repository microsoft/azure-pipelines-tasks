"use strict";

import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as utils from './utils/utilities';
import { deploy } from './deploy';
import { DockerConnection } from './dockerConnection';
import { CommandHelper } from './utils/commandHelper';

tl.setResourcePath(path.join(__dirname, "..", 'task.json'));

let telemetry = {
    jobId: tl.getVariable('SYSTEM_JOBID')
};

console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
    "TaskEndpointId",
    "AzureFunctionOnKubernetesV0",
    JSON.stringify(telemetry));

async function run() {
    const commandHelper = new CommandHelper();
    const dockerConnection = new DockerConnection();
    const kubernetesConnection = utils.getKubernetesConnection();
    dockerConnection.open();
    kubernetesConnection.open();

    try {
        await deploy(commandHelper, dockerConnection);
    }
    finally {
        kubernetesConnection.close();
        dockerConnection.close();
    }
}

run()
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));