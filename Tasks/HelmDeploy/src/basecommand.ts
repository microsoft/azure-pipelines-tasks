import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");
import os = require("os");
import tr = require('vsts-task-lib/toolrunner');

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

    public execCommandSync(command: tr.ToolRunner, options?: tr.IExecOptions) {
        basecommand.handleExecResult(command.execSync(options));
    }

    public IsInstalled(): boolean {
        return !!this.getToolPath();
    }

    public static handleExecResult(execResult: tr.IExecSyncResult) {
        if (execResult.code != tl.TaskResult.Succeeded || !!execResult.error || !!execResult.stderr) {
            tl.debug('execResult: ' + JSON.stringify(execResult));
            tl.setResult(tl.TaskResult.Failed, execResult.stderr);
        }
    }
}

export default basecommand;