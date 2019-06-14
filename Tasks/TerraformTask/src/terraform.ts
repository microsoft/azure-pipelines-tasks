// import { SpawnSyncOptionsWithStringEncoding } from "child_process";

// import task = require('azure-pipelines-task-lib/task');
// import path = require('path');

// async function run() {
//     task.debug('Task execution started');
//     // let providerName = task.getInput("provider");
//     // task.debug(providerName);
//     // task.setResourcePath(path.join( __dirname, 'task.json'));
//     let terraformPath = task.which("terraform", true);
//     task.debug(terraformPath);
//     task.debug('Task completed.');
// }

// run();


import {ToolRunner} from 'azure-pipelines-task-lib/toolrunner'

export class TerraformCommand {
    public readonly name: string;
    public readonly additionalArgs: string | undefined;
    public readonly workingDirectory: string;

    constructor(
        name: string,
        workingDirectory: string,
        additionalArgs?: string
    ) {
        this.name = name;
        this.workingDirectory = workingDirectory;  
        this.additionalArgs = additionalArgs;
    } 
}

export interface ITerraformToolHandler {
    create(command?: TerraformCommand): ToolRunner;
}

export class TerraformToolHandler implements ITerraformToolHandler {
    private readonly tasks: any;
    
    constructor(tasks: any) {
        this.tasks = tasks;
    }

    public create(command?: TerraformCommand): ToolRunner {
        let terraformPath = this.tasks.which("terraform", true);

        let terraformToolRunner: ToolRunner = this.tasks.tool(terraformPath);
        if (command) {
            terraformToolRunner.arg(command.name);
            if (command.additionalArgs) {
                terraformToolRunner.line(command.additionalArgs);
            }
        }
    }
}

