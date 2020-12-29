"use strict";
import * as tl from "azure-pipelines-task-lib/task";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as fileutils from "azure-pipelines-tasks-docker-common-v2/fileutils";

export function getFinalComposeFileName(): string {
    return ".docker-compose." + Date.now() + ".yml"
}

export function writeFileSync(filename: string, data: any, options?: { encoding?: string; mode?: number; flag?: string; }): void {
    fs.writeFileSync(filename, data, options);
}

function getTaskOutputDir(command: string): string {
    let tempDirectory = tl.getVariable('agent.tempDirectory') || os.tmpdir();
    let taskOutputDir = path.join(tempDirectory, "task_outputs");
    return taskOutputDir;
}

export function writeTaskOutput(commandName: string, output: string): string {
    let escapedCommandName = commandName.replace(/[\\\/:\*\?"<>\|]/g, "");
    let taskOutputDir = getTaskOutputDir(escapedCommandName);
    if (!fs.existsSync(taskOutputDir)) {
        fs.mkdirSync(taskOutputDir);
    }

    let outputFileName = escapedCommandName + "_" + Date.now() + ".log";
    let taskOutputPath = path.join(taskOutputDir, outputFileName);
    if (fileutils.writeFileSync(taskOutputPath, output) == 0) {
        tl.warning(tl.loc('NoDataWrittenOnFile', taskOutputPath));
    }
    
    return taskOutputPath;
}