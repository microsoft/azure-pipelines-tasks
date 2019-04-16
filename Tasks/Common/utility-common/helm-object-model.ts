import tl = require('vsts-task-lib/task');
import { IExecOptions, IExecSyncResult, IExecSyncOptions } from 'vsts-task-lib/toolrunner';

export interface NameValuePair {
    name: string;
    value: string;
}

export class Helm {
    private helmPath: string;
    private namespace: string;

    constructor(kubectlPath: string, namespace?: string) {
        this.helmPath = kubectlPath;
        if (!!namespace) {
            this.namespace = namespace;
        }
        else {
            this.namespace = "default";
        }
    }

    public template(chartPath: string, overrideFiles: string[], overrideValues: NameValuePair[]): IExecSyncResult {
        var command = tl.tool(this.helmPath);
        command.arg("template");
        command.arg(chartPath)
        command.arg(["--namespace", this.namespace]);
        if (overrideFiles.length > 0) {
            overrideFiles.forEach(file => {
                command.arg(["-f", file]);
            })
        }
        command.arg(this._buildSetArguments(overrideValues));
        return command.execSync();
    }

    private _buildSetArguments(overrideValues: NameValuePair[]): string[] {
        var newArgs = [];
        overrideValues.forEach(overrideValue => {
            newArgs.push("--set")
            newArgs.push(`${overrideValue.name}=${overrideValue.value}`);
        });

        return newArgs;
    }
}