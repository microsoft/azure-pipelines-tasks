import * as tl from 'vsts-task-lib/task';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

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