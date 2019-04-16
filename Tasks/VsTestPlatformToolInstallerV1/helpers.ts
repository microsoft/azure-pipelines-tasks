import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export function setVsTestToolLocation(toolPath: string) {
    // Set the task variable so that the VsTest task can consume this path
    tl.setVariable('VsTestToolsInstallerInstalledToolLocation', toolPath);
    console.log(tl.loc('InstallationSuccessful', toolPath));
    tl.debug(`Set variable VsTestToolsInstallerInstalledToolLocation value to ${toolPath}.`);
}

export function cleanUpTempConfigFile(tempConfigFilePath: string) {
    if (isNullEmptyOrUndefined(tempConfigFilePath)) {
        return;
    }

    try {
        fs.unlinkSync(tempConfigFilePath);
    } catch (error) {
        tl.debug(`Failed to delete temp config file ${tempConfigFilePath} with error ${error}.`);
    }
}

export function pathExistsAsFile(path: string) {
    return tl.exist(path) && tl.stats(path).isFile();
}

export function pathExistsAsDirectory(path: string) {
    return tl.exist(path) && tl.stats(path).isDirectory();
}

export function GenerateTempFile(fileName: string): string {
    return path.join(getTempFolder(), fileName);
}

export function isNullEmptyOrUndefined(obj: any) {
    return obj === null || obj === '' || obj === undefined;
}

export function isNullOrUndefined(obj: any) {
    return obj === null || obj === '' || obj === undefined;
}

export function isNullOrWhitespace(input: any) {
    if (typeof input === 'undefined' || input === null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}

export function getTempFolder(): string {
    try {
        tl.assertAgent('2.115.0');
        const tmpDir =  tl.getVariable('Agent.TempDirectory');
        return tmpDir;
    } catch (err) {
        tl.warning(tl.loc('UpgradeAgentMessage'));
        return os.tmpdir();
    }
}