import * as os from 'os';

import * as taskLib from 'azure-pipelines-task-lib/task';

import { NodeOsArch, NodeOsPlatform } from './interfaces/os-types';
import { installNodeRunner } from './modules/installNodeRunner';
import { NODE_INPUT_VERSIONS } from './constants';

async function runTask() {

    const inputVersion: string = taskLib.getInputRequired('runnerVersion');

    const targetNodeVersion = NODE_INPUT_VERSIONS[inputVersion];

    if (!targetNodeVersion) {
        throw new Error(`Target node version not matches with allowed versions. Possible variants: ${Object.keys(NODE_INPUT_VERSIONS)}`);
    }

    // Don't use `os.arch()` to construct download URLs,
    // Node.js uses a different set of arch identifiers for those.
    const osPlatform: NodeOsPlatform = os.platform();
    const force32bit: boolean = taskLib.getBoolInput('force32bit', false);
    const osArch = ((os.arch() === 'ia32' || force32bit) ? 'x86' : os.arch()) as NodeOsArch;

    await installNodeRunner(targetNodeVersion, { osArch, osPlatform });
}

runTask();
