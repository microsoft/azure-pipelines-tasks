"use strict";
import * as tl from "vsts-task-lib/task";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

function getTaskOutputDir(command: string): string {
    let tempDirectory = tl.getVariable('agent.tempDirectory') || os.tmpdir();
    let taskOutputDir = path.join(tempDirectory, "task_outputs");
    return taskOutputDir;
}

export function writeTaskOutput(commandName: string, output: string): string {
    let taskOutputDir = getTaskOutputDir(commandName);
    if (!fs.existsSync(taskOutputDir)) {
        fs.mkdirSync(taskOutputDir);
    }

    let outputFileName = commandName + "_" + Date.now() + ".txt";
    let taskOutputPath = path.join(taskOutputDir, outputFileName);
    fs.writeFileSync(taskOutputPath, output);
    return taskOutputPath;
}