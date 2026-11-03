import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import fs = require("fs");
import util = require("util");
import os = require("os");
import * as tr from "azure-pipelines-task-lib/toolrunner";
import basecommand from "./basecommand";

// This task builds a Helm command line by collecting arguments one at a time
// and handing each one to azure-pipelines-task-lib's ToolRunner. ToolRunner
// offers two different ways to add an argument:
//
//   - ToolRunner.line(value) treats "value" as a LINE OF TEXT and SPLITS it
//     into several argv elements on whitespace/quotes, the same way a shell
//     would. This is only correct for the task's own documented free-form
//     "arguments" input, where a customer is expected to type several Helm
//     flags in one box (e.g. "--atomic --timeout 5m0s").
//   - ToolRunner.arg(value) treats "value" as ONE OPAQUE TOKEN and passes it
//     to Helm completely unchanged, no matter what characters it contains.
//     This is the correct choice for every value the task resolves itself -
//     a release name, a file path, a namespace, a version - because none of
//     those are meant to be interpreted as a mini command line.
//
// To make the right choice obvious at every call site, every argument stored
// below is tagged with which ToolRunner method it must use:
interface StoredArgument {
    value: string;
    // true  -> added via addSingleArgument(); sent through ToolRunner.arg().
    // false -> added via addArgument();       sent through ToolRunner.line().
    isSingleToken: boolean;
}

export default class helmcli extends basecommand {

    private command: string;
    private arguments: StoredArgument[] = [];
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

    /**
     * Add a free-form LINE of text that may legitimately contain several
     * space-separated Helm options in one string, for example
     * "--atomic --timeout 5m0s". The value is split into multiple argv
     * elements by ToolRunner.line(), exactly like a shell would split it.
     *
     * Only the task's own documented "arguments" input should ever be
     * passed here - it is the one place a customer is expected to type
     * multiple Helm flags at once. Do not use this for a release name,
     * file path, namespace, version, or any other value the task resolves
     * itself.
     */
    public addArgument(argument: string): void {
        this.arguments.push({ value: argument, isSingleToken: false });
    }

    /**
     * Add a value that must reach Helm as exactly ONE argv element, no
     * matter what characters it contains - including spaces, quotes, or a
     * leading dash. The value is passed to ToolRunner.arg(), which never
     * splits or reinterprets it.
     *
     * Use this for every structured, already-resolved value the task
     * constructs or looks up itself: a release name, a file path, a
     * namespace, a version, or a flag name passed as its own separate
     * element. These values are never meant to be parsed as a mini
     * command line, so they must never go through addArgument()/line().
     */
    public addSingleArgument(argument: string): void {
        this.arguments.push({ value: argument, isSingleToken: true });
    }

    public getArguments(): string[] {
        return this.arguments.map(entry => entry.value);
    }

    public resetArguments(): void {
        this.arguments = [];
    }

    public getHelmVersion(): tr.IExecSyncResult {

        const useHelmVersionV3orHigher = tl.getPipelineFeature('UseHelmVersionV3orHigher');
        var command = this.createCommand();
        command.arg('version');
        if (!useHelmVersionV3orHigher) {
            command.line('--client');
        }
        command.line('--short');
        return this.execCommandSync(command);
    }

    public isHelmV3orHigher(): boolean {
        if (!this.helmVersion) {
            this.helmVersion = this.getHelmVersion().stdout;
        }
        const clientVersionRegex = /(?:client:\s*)?(v?\d+(?:\.\d+)+)/i;
        const match = this.helmVersion.match(clientVersionRegex);
        if (!match || !match[1]) {
            return false;
        }
        const versionString = match[1].replace('v', '');
        const majorVersion = parseInt(versionString.split('.')[0], 10);

        return !isNaN(majorVersion) && majorVersion >= 3;
    }
    
    public isHelmV37Plus(): boolean {
        if (!this.helmVersion)
            this.helmVersion = this.getHelmVersion().stdout;
        tl.debug("Helm version is " + this.helmVersion);
        // Parse the version string
        const version = this.helmVersion.match(/^v?(\d+)\.(\d+)\.(\d+)/);
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
        this.arguments.forEach((entry) => {
            if (entry.isSingleToken) {
                // Only add a non-empty value, and pass it as a one-element
                // ARRAY rather than a bare string. ToolRunner.arg()'s string
                // overload calls value.trim() - which would silently alter a
                // value containing meaningful leading/trailing whitespace
                // (e.g. a resolved path or credential) - while the array
                // overload performs no such transformation.
                if (entry.value) {
                    command.arg([entry.value]);
                }
            } else {
                command.line(entry.value);
            }
        });

        return this.execCommandSync(command, { silent: !!silent } as tr.IExecOptions);
    }
}
