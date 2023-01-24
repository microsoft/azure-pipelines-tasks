import * as path from 'path';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as os from 'os';

import { extractArchive } from '../utils/extractArchive';

const osPlatform: string = os.platform();
const force32bit: boolean = taskLib.getBoolInput('force32bit', false);
const osArch: string = (os.arch() === 'ia32' || force32bit) ? 'x86' : os.arch();

/** Installs target node from online
 * @returns installed node path
 */
export async function downloadNode(version: string, installedArch: string): Promise<string> {

    let downloadNodePath: string;

    if (osPlatform === 'win32') {
        downloadNodePath = await downloadWindowsNode(version);
    } else {
        // OSX, Linux
        downloadNodePath = await downloadUnixNode(version, installedArch);
    }

    taskLib.debug('Downloaded node path: ' + downloadNodePath);

    return downloadNodePath;
}

async function downloadUnixNode(version: string, installedArch: string): Promise<string> {

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
    let exeUrl: string;
    let libUrl: string;
    try {
        exeUrl = `https://nodejs.org/dist/v${version}/win-${osArch}/node.exe`;
        libUrl = `https://nodejs.org/dist/v${version}/win-${osArch}/node.lib`;

        await toolLib.downloadTool(exeUrl, path.join(downloadPath, 'node.exe'));
        await toolLib.downloadTool(libUrl, path.join(downloadPath, 'node.lib'));
    } catch (err) {
        if (err.httpStatusCode &&
            err.httpStatusCode === 404) {
            exeUrl = `https://nodejs.org/dist/v${version}/node.exe`;
            libUrl = `https://nodejs.org/dist/v${version}/node.lib`;

            await toolLib.downloadTool(exeUrl, path.join(downloadPath, 'node.exe'));
            await toolLib.downloadTool(libUrl, path.join(downloadPath, 'node.lib'));
        } else {
            throw err;
        }
    }

    return downloadPath;
}
