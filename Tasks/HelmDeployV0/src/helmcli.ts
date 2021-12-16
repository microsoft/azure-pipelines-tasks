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

    /*
    checks for helm version 3 and minor version 7 or higher
    */
    public isHelmV37(): boolean {
        if (this.isHelmV3()){
            let minorversion = this.helmVersion;
            // get minor version 3.7.0 -> "7"
            minorversion = minorversion.slice(minorversion.indexOf('.')+1,minorversion.lastIndexOf('.'));
            if (Number(minorversion) >= 7)
                return true;
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
