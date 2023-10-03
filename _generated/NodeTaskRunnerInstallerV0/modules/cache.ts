import * as fs from 'fs';
import * as path from 'path';

import * as taskLib from 'azure-pipelines-task-lib';

import { RunnerVersion } from '../constants';
import { NodeOsPlatform } from '../interfaces/os-types';
import { getAgentExternalsPath } from '../utils/getAgentExternalsPath';

export function isRunnerInstalled(targetRunner: RunnerVersion, osPlatform: NodeOsPlatform): boolean {

    const agentExternals = getAgentExternalsPath();

    const nodeBinName = osPlatform === 'win32' ? 'node.exe' : 'node';
    const nodeFolder = targetRunner === RunnerVersion.node6 ? 'node' : 'node10';

    const nodePath = path.join(agentExternals, nodeFolder, 'bin', nodeBinName);

    taskLib.debug('Checking if node runner already installed. Path = ' + nodePath);

    return fs.existsSync(nodePath);
}
