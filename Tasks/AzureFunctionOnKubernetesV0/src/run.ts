"use strict";

import path = require('path');
import * as tl from "azure-pipelines-task-lib/task";
import { deploy } from './deploy';
import { DockerConnection } from './dockerConnection';
import { KubernetesConnection } from './kubernetesConnection';
import { CommandHelper } from './utils/commandHelper';

tl.setResourcePath(path.join(__dirname, "..", 'task.json'));

async function run() {
    const commandHelper = new CommandHelper();
    const kubernetesConnection = new KubernetesConnection();
    const dockerConnection = new DockerConnection();
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

try {
    run();
}
catch(error) {
    tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error);
}