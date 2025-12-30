"use strict";
import * as tl from "azure-pipelines-task-lib/task";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as fileutils from "azure-pipelines-tasks-docker-common/fileutils";

export function getFinalComposeFileName(): string {
    return ".docker-compose." + Date.now() + ".yml"
}

export function writeFileSync(filename: string, data: any, options?: { encoding?: BufferEncoding; mode?: number; flag?: string; }): void {
    fs.writeFileSync(filename, data, options);
}

function getTaskOutputDir(command: string): string {
    let tempDirectory = tl.getVariable('agent.tempDirectory') || os.tmpdir();
    let taskOutputDir = path.join(tempDirectory, "task_outputs");
    return taskOutputDir;
}

/**
 * Checks if BuildKit is expected to be in use.
 * BuildKit sends output to stderr (structured progress), not stdout.
 * Docker 23.0+ (Feb 2023) makes BuildKit the default builder.
 * 
 * @returns true if BuildKit is expected, false if legacy builder is in use
 */
function isBuildKitExpected(): boolean {
    const buildKitEnv = process.env.DOCKER_BUILDKIT || tl.getVariable('DOCKER_BUILDKIT');
    
    if (buildKitEnv === '1') {
        tl.debug('BuildKit explicitly enabled via DOCKER_BUILDKIT=1');
        return true;
    }
    
    if (buildKitEnv === '0') {
        tl.debug('BuildKit explicitly disabled via DOCKER_BUILDKIT=0 (legacy builder)');
        return false;
    }
    
    // When DOCKER_BUILDKIT is not set, assume modern Docker 23+ with BuildKit as default
    // This prevents false warnings on systems where BuildKit is the default behavior
    tl.debug('DOCKER_BUILDKIT not set - assuming modern Docker 23+ with BuildKit default');
    return true;
}

export function writeTaskOutput(commandName: string, output: string): string {
    let escapedCommandName = commandName.replace(/[\\\/:*?"<>|]/g, "");
    let taskOutputDir = getTaskOutputDir(escapedCommandName);
    if (!fs.existsSync(taskOutputDir)) {
        fs.mkdirSync(taskOutputDir);
    }

    let outputFileName = escapedCommandName + "_" + Date.now() + ".log";
    let taskOutputPath = path.join(taskOutputDir, outputFileName);
    const bytesWritten = fileutils.writeFileSync(taskOutputPath, output);
    
    // Only warn about empty output when using legacy builder
    // BuildKit (default since Docker 23.0) outputs to stderr, not stdout
    if (bytesWritten === 0 && !isBuildKitExpected()) {
        tl.warning(tl.loc('NoDataWrittenOnFile', taskOutputPath));
    } else if (bytesWritten === 0) {
        tl.debug(`Empty output file (${taskOutputPath}) is expected when using BuildKit`);
    }
    
    return taskOutputPath;
}
