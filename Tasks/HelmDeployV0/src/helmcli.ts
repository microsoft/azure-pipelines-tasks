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
        command.line('--short');

        const result = this.execCommandSync(command);
        const raw = (result.stdout || '').trim();
        const lines = raw.split(/\r?\n/);
        const clientLine = lines.find(l => /^Client:/i.test(l)) ?? lines[0] ?? '';
        const clientOnly = clientLine.replace(/^Client:\s*/i, '').trim();

        let output = clientOnly;
        if (clientOnly.startsWith('v2')) {
            output = clientOnly ? `Client: ${clientOnly}` : clientLine;
        }

        return Object.assign({}, result, { stdout: output });
    }

    public isHelmV3orGreater(): boolean {
        if (!this.helmVersion)
            this.helmVersion = this.getHelmVersion().stdout;
        tl.debug(`Helm client version: ${this.helmVersion}`);

        const versionMatch = this.helmVersion.match(/v(\d+)\./);
        if (versionMatch) {
            const majorVersion = parseInt(versionMatch[1], 10);
            return majorVersion >= 3;
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
