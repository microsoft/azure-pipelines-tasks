import * as os from 'os';

import * as taskLib from 'azure-pipelines-task-lib/task';

import { NodeOsArch, NodeOsPlatform } from './interfaces/os-types';
import { installNodeRunner } from './modules/installNodeRunner';
import { NODE_INPUT_VERSIONS } from './constants';

async function runTask() {

    const inputVersion: string = taskLib.getInputRequired('runnerVersion');

    const targetNodeVersion: string = NODE_INPUT_VERSIONS[inputVersion];

    if (!targetNodeVersion) {
        throw new Error(taskLib.loc('NotAllowedNodeVersion', Object.keys(NODE_INPUT_VERSIONS).join(", ")));
    }

    const currentRunner = process.versions.node;
    taskLib.debug("Current runner version = " + currentRunner)

    if (currentRunner === targetNodeVersion) {
        throw new Error(taskLib.loc("SameRunnersError", currentRunner));
    }

    const osPlatform: NodeOsPlatform = os.platform();
    const force32bit: boolean = taskLib.getBoolInput('force32bit', false);
    const osArch = ((os.arch() === 'ia32' || force32bit) ? 'x86' : os.arch()) as NodeOsArch;

    await installNodeRunner(targetNodeVersion, { osArch, osPlatform });
}

runTask();
