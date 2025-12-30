"use strict";
import * as tl from "azure-pipelines-task-lib/task";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as fileutils from "azure-pipelines-tasks-docker-common/fileutils";

function getTaskOutputDir(command: string): string {
    let tempDirectory = tl.getVariable('agent.tempDirectory') || os.tmpdir();
    let taskOutputDir = path.join(tempDirectory, "task_outputs");
    return taskOutputDir;
}

/**
 * Checks if BuildKit is expected to be in use based on environment and Docker version.
 * BuildKit sends output to stderr as structured progress, not stdout.
 * @returns true if BuildKit is likely being used (empty stdout is expected)
 */
function isBuildKitExpected(): boolean {
    // Check if DOCKER_BUILDKIT environment variable is explicitly set to 1
    const buildKitEnv = process.env.DOCKER_BUILDKIT || tl.getVariable('DOCKER_BUILDKIT');
    if (buildKitEnv === '1') {
        tl.debug('BuildKit is enabled via DOCKER_BUILDKIT=1');
        return true;
    }

    // Docker 23.0+ enables BuildKit by default, even without DOCKER_BUILDKIT set
    // We can't reliably detect Docker version without running a command,
    // so we use a heuristic: if DOCKER_BUILDKIT is explicitly set to 0, legacy builder is in use
    if (buildKitEnv === '0') {
        tl.debug('BuildKit is explicitly disabled via DOCKER_BUILDKIT=0');
        return false;
    }

    // If DOCKER_BUILDKIT is not set, we assume modern Docker (23+) with BuildKit as default
    // This is safer than warning unnecessarily, as Docker 23.0 was released in Feb 2023
    // and is widely deployed by now (late 2025)
    tl.debug('DOCKER_BUILDKIT not set; assuming modern Docker with BuildKit as default');
    return true;
}

export function writeTaskOutput(commandName: string, output: string): string {
    let taskOutputDir = getTaskOutputDir(commandName);
    if (!fs.existsSync(taskOutputDir)) {
        fs.mkdirSync(taskOutputDir);
    }

    let outputFileName = commandName + "_" + Date.now() + ".txt";
    let taskOutputPath = path.join(taskOutputDir, outputFileName);
    
    const bytesWritten = fileutils.writeFileSync(taskOutputPath, output);
    
    // Only warn about empty output if we're using the legacy builder (which produces stdout)
    // BuildKit (Docker 23+ default, or DOCKER_BUILDKIT=1) sends output to stderr, not stdout,
    // so empty stdout is expected and not an error condition.
    if (bytesWritten === 0 && !isBuildKitExpected()) {
        tl.warning(tl.loc('NoDataWrittenOnFile', taskOutputPath));
    } else if (bytesWritten === 0) {
        tl.debug(`Empty output file (${taskOutputPath}) is expected when using BuildKit`);
    }
    
    return taskOutputPath;
}