import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as path from 'path';
import * as fs from 'fs';

import { downloadNodeRunner } from './downloadNode';
import { isDarwinArmWithRosetta } from '../utils/isDarwinArmWithRosetta';
import { getAgentExternalsPath } from '../utils/getAgentExternalsPath';
import { getDirContent } from '../utils/getDirContent';
import { NodeOsPlatform, TargetOsInfo } from '../interfaces/os-types';

export async function installNodeRunner(targetNodeVersion: string, osInfo: TargetOsInfo) {
    let installedArch = osInfo.osArch;

    let targetNodePath: string;

    // check cache
    targetNodePath = toolLib.findLocalTool('node', targetNodeVersion, installedArch);

    // In case if it's darwin arm and toolPath is empty trying to find x64 version
    if (!targetNodePath && isDarwinArmWithRosetta(osInfo.osPlatform, installedArch)) {
        targetNodePath = toolLib.findLocalTool('node', installedArch, 'x64');
        installedArch = 'x64';
    }

    if (!targetNodePath) {
        const cleanVersion = toolLib.cleanVersion(targetNodeVersion);
        targetNodePath = await taskLib.retry(
            async () => await downloadNodeRunner(cleanVersion, { osPlatform: osInfo.osPlatform, osArch: installedArch }),
            undefined,
            { retryCount: 3, continueOnError: false }
        );
    }

    const resultNodePath = await copyNodeToAgentExternals(targetNodePath, 'node', osInfo.osPlatform);

    taskLib.debug('resultNodePath = ' + resultNodePath);

    getDirContent(resultNodePath);
}

async function copyNodeToAgentExternals(nodePath: string, targetNodeDir: string, osPlatform: NodeOsPlatform): Promise<string> {
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
