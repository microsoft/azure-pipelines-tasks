import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import fs = require("fs");
import util = require("util");
import os = require("os");
import * as tr from "azure-pipelines-task-lib/toolrunner";
import basecommand from "./basecommand";

export default class helmcli extends basecommand {

    private command: string;
    private arguments: string[] = [];
    private helmVersion: string;

    constructor() {
        super(true)
    }

    public getTool(): string {
        return "helm";
    }

    public login(): void {

    }

    public logout(): void {

    }

    public setCommand(command: string): void {
        this.command = command;
    }

    public getCommand(): string {
        return this.command;
    }

    public addArgument(argument: string): void {
        this.arguments.push(argument);
    }

    public getArguments(): string[] {
        return this.arguments;
    }

    public resetArguments(): void {
        this.arguments = [];
    }

    public getHelmVersion(): tr.IExecSyncResult {
        var command = this.createCommand();
        command.arg('version');
        command.line('--client');
        command.line('--short');

        return this.execCommandSync(command);
    }

    public isHelmV3(): boolean {
        if (!this.helmVersion)
            this.helmVersion = this.getHelmVersion().stdout;
        if (this.helmVersion.startsWith("v3"))
            return true;
        return false;
    }
    
    public isHelmV37Plus(): boolean {
        if (!this.helmVersion)
            this.helmVersion = this.getHelmVersion().stdout;
        tl.debug("Helm version is " + this.helmVersion);
        // Parse the version string
        const version = this.helmVersion.match(/^v(\d+)\.(\d+)\.(\d+)/);
        if (version) {
            const major = parseInt(version[1]);
            const minor = parseInt(version[2]);
            const patch = parseInt(version[3]);

            // Compare with v3.7.0
            if (major > 3 || (major === 3 && (minor > 7 || (minor === 7 && patch >= 0)))) {
                return true;
            }
        }
        return false;
    }

    public execHelmCommand(silent?: boolean): tr.IExecSyncResult {
        var command = this.createCommand();
        command.arg(this.command);
        this.arguments.forEach((value) => {
            command.line(value);
        });

        return this.execCommandSync(command, { silent: !!silent } as tr.IExecOptions);
    }
}
