import * as os from 'os';

import * as taskLib from 'azure-pipelines-task-lib/task';

import { NodeOsArch, NodeOsPlatform } from './interfaces/os-types';
import { installNodeRunner } from './modules/installNodeRunner';
import { NODE_INPUT_VERSIONS } from './constants';
import { mapOsArchToDistroVariant } from './utils/mapOsArchToDistroVariant';

async function runTask() {

    const inputVersion: string = taskLib.getInputRequired('runnerVersion');

    const targetNodeVersion: string = NODE_INPUT_VERSIONS[inputVersion];

    if (!targetNodeVersion) {
        throw new Error(taskLib.loc('NotAllowedNodeVersion', Object.keys(NODE_INPUT_VERSIONS).join(', ')));
    }

    const currentRunner = process.versions.node;
    taskLib.debug('Current runner version = ' + currentRunner);

    if (currentRunner === targetNodeVersion) {
        throw new Error(taskLib.loc('SameRunnersError', currentRunner));
    }

    const osPlatform: NodeOsPlatform = os.platform();

    const supportedOsList: NodeOsPlatform[] = ['linux', 'darwin', 'win32'];

    if (!supportedOsList.includes(osPlatform)) {
        throw new Error(taskLib.loc('UnexpectedOS', osPlatform, supportedOsList.join(', ')));
    }

    const osArch = mapOsArchToDistroVariant(os.arch() as NodeOsArch);

    await installNodeRunner(targetNodeVersion, { osArch, osPlatform });
}

runTask();
