"use strict";

var fs = require('fs');
import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as os from "os";

export function getTempDirectory(): string {
    return tl.getVariable('agent.tempDirectory') || os.tmpdir();
}

export function getNewUserDirPath(): string {
    var userDir = path.join(getTempDirectory(), "kubectlTask");
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
    let newFilePaths = [];
    inputObjects.forEach((inputObject: any) => {
        var inputObjectString = JSON.stringify(inputObject);
        let fileName = getManifestFileName(inputObject.kind, inputObject.metadata.name);
        fs.writeFileSync(
            path.join(fileName),
            inputObjectString);
        newFilePaths.push(fileName);
    });

    return newFilePaths;
}

function getManifestFileName(kind: string, name: string)
{
    var filePath = kind + "_" + name + "_" + getCurrentTime().toString();
    const tempDirectory = getTempDirectory();
    var fileName =  path.join(tempDirectory, path.basename(filePath));
    return fileName;
}

function getCurrentTime(): number {
    return new Date().getTime();
}


