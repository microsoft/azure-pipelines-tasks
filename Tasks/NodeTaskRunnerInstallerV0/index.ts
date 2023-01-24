import * as taskLib from 'azure-pipelines-task-lib/task';
import { NODE_INPUT_VERSIONS } from './models/targetNodeVersions';
import { setupNode } from './modules/setupNode';

async function runTask() {

    const inputVersion: string = taskLib.getInputRequired('runnerVersion');

    const targetNodeVersion = NODE_INPUT_VERSIONS[inputVersion];

    if (!targetNodeVersion) {
        throw new Error(`Target node version not matches with allowed versions. Possible variants: ${Object.keys(NODE_INPUT_VERSIONS)}`);
    }

    await setupNode(targetNodeVersion);
}

runTask();
