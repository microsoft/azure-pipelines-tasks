import * as taskLib from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import { NOTATION_VERSION_FILE } from './lib/constants';
import { getDownloadInfo, installFromURL } from './lib/install';

export async function install(): Promise<void> {
    // the notation download URL
    let version = '';
    let downloadURL = '';
    let checksum: string;

    if (taskLib.getBoolInput('isCustomVersion', false)) {
        // for custom version, download the notation from specified URL
        downloadURL = taskLib.getInput('url', true) || '';
        checksum = taskLib.getInput('checksum', true) || '';
    } else {
        const versionPrefix = taskLib.getInput('version', true) || '';
        const downloadInfo = getDownloadInfo(versionPrefix, NOTATION_VERSION_FILE);
        version = downloadInfo.version;
        downloadURL = downloadInfo.url;
        checksum = downloadInfo.checksum;
    }

    // install notation binary
    const extractPath = taskLib.getVariable('Agent.TempDirectory');
    if (!extractPath) {
        throw new Error(taskLib.loc('TempDirectoryNotSet'));
    }
    await installFromURL(downloadURL, checksum, extractPath);

    // add to path for subsequent tasks
    taskLib.prependPath(extractPath);
    // add to path for current process
    process.env['PATH'] = `${extractPath}${path.delimiter}${process.env['PATH']}`;

    if (!version) {
        console.log(taskLib.loc('NotationInstalledFromURL', downloadURL));
    } else {
        console.log(taskLib.loc('NotationInstalledFromVersion', version));
    }
}
