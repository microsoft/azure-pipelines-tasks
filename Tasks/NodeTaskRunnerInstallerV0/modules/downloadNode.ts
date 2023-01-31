import * as path from 'path';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as os from 'os';

import { extractArchive } from '../utils/extractArchive';
import { isDarwinArmWithRosetta } from '../utils/isDarwinArmWithRosetta';
import { NodeOsArch, NodeOsPlatform } from '../interfaces/os-types';

const osPlatform: NodeOsPlatform = os.platform();
const force32bit: boolean = taskLib.getBoolInput('force32bit', false);
const osArch = ((os.arch() === 'ia32' || force32bit) ? 'x86' : os.arch()) as NodeOsArch;

/** Installs target node from online
 * @param {string} version Node version to install
 * @param {string} installedArch PC Architecture
 * @returns Installed node path
 */
export async function downloadNode(version: string, installedArch: NodeOsArch): Promise<string> {

    let downloadNodePath: string;

    try {
        if (osPlatform === 'win32') {
            downloadNodePath = await downloadWindowsNode(version);
        } else {
            // OSX, Linux
            downloadNodePath = await downloadUnixNode(version, installedArch);
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

async function downloadUnixNode(version: string, installedArch: NodeOsArch): Promise<string> {

    if (!version && isDarwinArmWithRosetta(osPlatform, installedArch)) {
        // nodejs.org does not have an arm64 build for macOS, so we fall back to x64
        console.log(taskLib.loc('TryRosetta', osPlatform, installedArch));
        installedArch = 'x64';
    }

    const urlFileName = `node-v${version}-${osPlatform}-${installedArch}.tar.gz`;
    const downloadUrl = 'https://nodejs.org/dist/v' + version + '/' + urlFileName;

    const downloadPath = await toolLib.downloadTool(downloadUrl);
    const extractedPath = await extractArchive(downloadPath);

    return extractedPath;
}

async function downloadWindowsNode(version: string): Promise<string> {
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
