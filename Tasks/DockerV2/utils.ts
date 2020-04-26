"use strict";
import * as tl from "azure-pipelines-task-lib/task";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as fileutils from "docker-common-v2/fileutils";

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
    if (fileutils.writeFileSync(taskOutputPath, output) == 0) {
        tl.warning(tl.loc('NoDataWrittenOnFile', taskOutputPath));
    }
    
    return taskOutputPath;
}

export function getDelimitedInput(inputVal: string, delimters: string[]): string[] {
    if (!inputVal) {
        return [];
    }

    let regex = undefined;
    if (delimters.length > 1) {
        regex = new RegExp(delimters.join("|"));
    } else {
        regex = new RegExp(delimters[0]);
    }

    let result: string[] = [];
    inputVal.split(regex).forEach((x: string) => {
        if (x) {
            result.push(x);
        }
    });

    return result;
}