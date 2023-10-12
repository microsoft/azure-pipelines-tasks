import * as os from 'os';

import * as taskLib from 'azure-pipelines-task-lib/task';

import { NodeOsArch, NodeOsPlatform } from './interfaces/os-types';
import { installNodeRunner } from './modules/installNodeRunner';
import { NODE_INPUT_VERSIONS, RunnerVersion } from './constants';
import { mapOsArchToDistroVariant } from './utils/mapOsArchToDistroVariant';
import { isRunnerInstalled } from './modules/cache';

async function runTask() {

    const runnerInputVersion: string = taskLib.getInputRequired('runnerVersion');

    const targetRunnerVersion: RunnerVersion = NODE_INPUT_VERSIONS[runnerInputVersion];

    if (!targetRunnerVersion) {
        throw new Error(taskLib.loc('NotAllowedNodeVersion', Object.keys(NODE_INPUT_VERSIONS).join(', ')));
    }

    const currentRunnerVersion = process.versions.node;
    taskLib.debug('Current runner version = ' + currentRunnerVersion);

    if (currentRunnerVersion === targetRunnerVersion) {
        console.log(taskLib.loc('RunnerAlreadyInUse', currentRunnerVersion));
        return;
    }

    const osPlatform: NodeOsPlatform = os.platform();

    const supportedOsList: NodeOsPlatform[] = ['linux', 'darwin', 'win32'];

    if (!supportedOsList.includes(osPlatform)) {
        throw new Error(taskLib.loc('UnexpectedOS', osPlatform, supportedOsList.join(', ')));
    }

    if (isRunnerInstalled(targetRunnerVersion, osPlatform)) {
        console.log(taskLib.loc('RunnerAlreadyInstalled', targetRunnerVersion));
        return;
    }

    const osArch = mapOsArchToDistroVariant(os.arch() as NodeOsArch);

    await installNodeRunner(targetRunnerVersion, { osArch, osPlatform });
}

runTask();
