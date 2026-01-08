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

        const useHelmVersionV3orHigher = tl.getPipelineFeature('UseHelmVersionV3orHigher');

        var command = this.createCommand();
        command.arg('version');
        command.line('--short');

        if (useHelmVersionV3orHigher) {

            const result = this.execCommandSync(command);
            const clientVersionRegex = /(?:client:\s*)?(v?\d+(?:\.\d+)+)/i;
            const output = result.stdout.trim();
            const match = output.match(clientVersionRegex);
            const clientVersion = match ? match[1] : null;

            return { stdout: clientVersion || '', stderr: result.stderr, code: result.code, error: result.error };
        }

        command.line('--client');

        return this.execCommandSync(command);
    }

    public isHelmV3orHigher(): boolean {
        if (!this.helmVersion)
            this.helmVersion = this.getHelmVersion().stdout;
        tl.debug(`Helm client version: ${this.helmVersion}`);

        const versionString = this.helmVersion.replace('v', '');
        const majorVersion = parseInt(versionString.split('.')[0], 10);

        return !isNaN(majorVersion) && majorVersion >= 3;
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
