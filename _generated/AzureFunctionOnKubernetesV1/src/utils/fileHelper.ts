'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as os from 'os';

export function getTempDirectory(): string {
    return tl.getVariable('agent.tempDirectory') || os.tmpdir();
}

export function ensureDirExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}

export function getTaskTempDir(): string {
    const tempDirectory = getTempDirectory();
    const funcSuffix = 'funckubetask_' + getCurrentTime().toString();
    const userDir = path.join(tempDirectory, funcSuffix);
    ensureDirExists(userDir);

    return userDir;
}

export function writeContentToFile(filePath: string, content: string) {
    try {
        fs.writeFileSync(filePath, content);
    } catch (ex) {
        tl.debug('Exception occurred while wrting content to file : ' + content + ' . Exception: ' + ex);
    }
}

export function getFuncKubernetesYamlPath(): string {
    const tasktempDir = getTaskTempDir();
    return path.join(tasktempDir, 'resource_templates.yaml');
}

function getCurrentTime(): number {
    return new Date().getTime();
}