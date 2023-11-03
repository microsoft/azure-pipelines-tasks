import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import fs = require("fs");
import util = require("util");
import os = require("os");
import tr = require('azure-pipelines-task-lib/toolrunner');

abstract class basecommand {
    private toolPath: string;
    abstract getTool(): string;
    abstract login(): void;
    abstract logout(): void;

    constructor(required: boolean) {
        this.toolPath = tl.which(this.getTool(), required);
    }

    public getToolPath(): string {
        return this.toolPath;
    }

    public createCommand(): tr.ToolRunner {
        var command = tl.tool(this.toolPath);
        return command;
    }

    public execCommand(command: tr.ToolRunner, options?: tr.IExecOptions) {
        var errlines = [];
        command.on("stderr", line => {
            errlines.push(line);
        });

        command.on("error", line => {
            errlines.push(line);
        });

        return command.exec(options).fail(error => {
            errlines.forEach(line => tl.error(line));
            throw error;
        });
    }

    public execCommandSync(command: tr.ToolRunner, options?: tr.IExecOptions): tr.IExecSyncResult {
        return command.execSync(options);
    }

    public IsInstalled(): boolean {
        return !!this.getToolPath();
    }

    public static handleExecResult(execResult: tr.IExecSyncResult) {
        if (execResult.code != tl.TaskResult.Succeeded) {

            tl.debug('execResult: ' + JSON.stringify(execResult));
            if(!!execResult.error || !!execResult.stderr) {
                tl.setResult(tl.TaskResult.Failed, execResult.stderr);
            }
            else
            {
                tl.setResult(tl.TaskResult.Failed, "");
            }
        }
    }
}

export default basecommand;