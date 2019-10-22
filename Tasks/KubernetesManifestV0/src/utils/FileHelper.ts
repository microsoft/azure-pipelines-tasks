'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as os from 'os';

export function getTempDirectory(): string {
    return tl.getVariable('agent.tempDirectory') || os.tmpdir();
}

export function getNewUserDirPath(): string {
    let userDir = path.join(getTempDirectory(), 'kubectlTask');
    ensureDirExists(userDir);

    userDir = path.join(userDir, getCurrentTime().toString());
    ensureDirExists(userDir);

    return userDir;
}

export function ensureDirExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}

export function assertFileExists(path: string) {
    if (!fs.existsSync(path)) {
        tl.error(tl.loc('FileNotFoundException', path));
        throw new Error(tl.loc('FileNotFoundException', path));
    }
}

export function writeObjectsToFile(inputObjects: any[]): string[] {
    const newFilePaths = [];

    if (!!inputObjects) {
        inputObjects.forEach((inputObject: any) => {
            try {
                const inputObjectString = JSON.stringify(inputObject);
                if (!!inputObject.kind && !!inputObject.metadata && !!inputObject.metadata.name) {
                    const fileName = getManifestFileName(inputObject.kind, inputObject.metadata.name);
                    fs.writeFileSync(path.join(fileName), inputObjectString);
                    newFilePaths.push(fileName);
                } else {
                    tl.debug('Input object is not proper K8s resource object. Object: ' + inputObjectString);
                }
            } catch (ex) {
                tl.debug('Exception occurred while writing object to file : ' + inputObject + ' . Exception: ' + ex);
            }
        });
    }

    return newFilePaths;
}

export function writeManifestToFile(inputObjectString: string, kind: string, name: string): string {
    if (inputObjectString) {
        try {
            const fileName = getManifestFileName(kind, name);
            fs.writeFileSync(path.join(fileName), inputObjectString);
            return fileName;
        } catch (ex) {
            tl.debug('Exception occurred while writing object to file : ' + inputObjectString + ' . Exception: ' + ex);
        }
    }
    return '';
}

function getManifestFileName(kind: string, name: string) {
    const filePath = kind + '_' + name + '_' + getCurrentTime().toString();
    const tempDirectory = getTempDirectory();
    const fileName = path.join(tempDirectory, path.basename(filePath));
    return fileName;
}

function getCurrentTime(): number {
    return new Date().getTime();
}

