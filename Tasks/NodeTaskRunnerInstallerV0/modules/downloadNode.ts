import * as path from 'path';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';

import { extractArchive } from '../utils/extractArchive';
import { isDarwinArmWithRosetta } from '../utils/isDarwinArmWithRosetta';
import { NodeDistroOsArch, TargetOsInfo } from '../interfaces/os-types';

/**
 * Installs target node runner from online.
 *
 * @param version Node version to install.
 * @param osInfo Target OS for runner.
 * @returns Installed node runner path.
 */
export async function downloadNodeRunner(version: string, osInfo: TargetOsInfo): Promise<string> {

    let downloadNodePath: string;

    try {
        if (osInfo.osPlatform === 'win32') {
            downloadNodePath = await downloadWindowsNode(version, osInfo.osArch);
        } else {
            // OSX, Linux
            downloadNodePath = await downloadUnixNode(version, osInfo);
        }
    } catch (err) {
        if (err.httpStatusCode) {
            if (err.httpStatusCode === 404) {
                throw new Error('Target node version not found. Please contact with task support. Error: ' + err);
            } else {
                throw new Error('Something went wrong. Error: ' + err);
            }
        }

        throw err;
    }

    taskLib.debug('Downloaded node path: ' + downloadNodePath);

    return downloadNodePath;
}

async function downloadUnixNode(version: string, osInfo: TargetOsInfo): Promise<string> {
    let targetOsArch = osInfo.osArch;

    if (!version && isDarwinArmWithRosetta(osInfo.osPlatform, osInfo.osArch)) {
        // nodejs.org does not have an arm64 build for macOS, so we fall back to x64
        console.log(taskLib.loc('TryRosetta', osInfo.osPlatform, targetOsArch));
        targetOsArch = 'x64';
    }

    const urlFileName = `node-v${version}-${osInfo.osPlatform}-${targetOsArch}.tar.gz`;
    const downloadUrl = 'https://nodejs.org/dist/v' + version + '/' + urlFileName;

    const downloadPath = await toolLib.downloadTool(downloadUrl);
    const extractedPath = await extractArchive(downloadPath);

    return extractedPath;
}

async function downloadWindowsNode(version: string, osArch: NodeDistroOsArch): Promise<string> {

    // Create temporary folder to download in to
    const tempDownloadFolder: string = 'temp_' + Math.floor(Math.random() * 2000000000);
    const downloadPath: string = path.join(taskLib.getVariable('agent.tempDirectory'), tempDownloadFolder);
    taskLib.mkdirP(downloadPath);

    const exeUrl = `https://nodejs.org/dist/v${version}/win-${osArch}/node.exe`;
    const libUrl = `https://nodejs.org/dist/v${version}/win-${osArch}/node.lib`;

    await toolLib.downloadTool(exeUrl, path.join(downloadPath, 'node.exe'));
    await toolLib.downloadTool(libUrl, path.join(downloadPath, 'node.lib'));

    return downloadPath;
}
