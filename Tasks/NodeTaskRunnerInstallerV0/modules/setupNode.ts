import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import { downloadNode } from './downloadNode';
import { isDarwinArm } from '../utils/isDarwinArm';
import { getAgentExternalsPath } from '../utils/getAgentExternalsPath';
import { getDirContent } from '../utils/getDirContent';

// Don't use `os.arch()` to construct download URLs,
// Node.js uses a different set of arch identifiers for those.
const force32bit: boolean = taskLib.getBoolInput('force32bit', false);
const osArch: string = (os.arch() === 'ia32' || force32bit) ? 'x86' : os.arch();

const osPlatform: string = os.platform();

export async function setupNode(targetNodeVersion: string) {
    const installedArch = osArch;

    let targetNodePath: string;

    // check cache
    targetNodePath = toolLib.findLocalTool('node', targetNodeVersion, installedArch);

    // In case if it's darwin arm and toolPath is empty trying to find x64 version
    if (!targetNodePath && isDarwinArm(osPlatform, installedArch)) {
        targetNodePath = toolLib.findLocalTool('node', installedArch, 'x64');
    }

    if (!targetNodePath) {
        // download, extract, cache
        const cleanVersion = toolLib.cleanVersion(targetNodeVersion);
        targetNodePath = await downloadNode(cleanVersion, installedArch);
    }

    const resultNodePath = await copyNodeToAgentExternals(targetNodePath, 'node');

    taskLib.debug('resultNodePath = ' + resultNodePath);

    getDirContent(resultNodePath);
}

async function copyNodeToAgentExternals(nodePath: string, targetNodeDir: string): Promise<string> {
    const externalsPath = getAgentExternalsPath();

    const targetNodePath = path.join(externalsPath, targetNodeDir);

    taskLib.rmRF(targetNodePath);
    taskLib.mkdirP(targetNodePath);

    if (osPlatform === 'win32') {
        copyWindowsNodeToAgentExternals(nodePath, targetNodePath);
    } else {
        copyUnixNodeToAgentExternals(nodePath, targetNodePath);
    }

    return targetNodePath;
}

function copyWindowsNodeToAgentExternals(nodeCurrentLocation: string, targetNodeLocation: string) {
    const binPath = path.join(targetNodeLocation, 'bin');

    taskLib.mkdirP(binPath);
    taskLib.debug('TARGET NODE PATH = ' + binPath);

    const nodeExePath = path.join(nodeCurrentLocation, 'node.exe');
    taskLib.cp(nodeExePath, binPath, '-rf');

    const nodeLibPath = path.join(nodeCurrentLocation, 'node.lib');
    taskLib.cp(nodeLibPath, binPath, '-rf');

    getDirContent(binPath);

    return path.resolve(binPath, '..');
}

function copyUnixNodeToAgentExternals(nodeCurrentPath: string, targetNodePath: string) {
    const newstedDir = fs.readdirSync(nodeCurrentPath)[0];

    taskLib.debug('Nested node directory = ' + newstedDir);

    const nestedDirPath = path.join(nodeCurrentPath, newstedDir);

    taskLib.cp(nestedDirPath + '/*', targetNodePath + '/', '-rf');
    // taskLib.rmRF(newstedDir);

    getDirContent(targetNodePath);

    return targetNodePath;
}
