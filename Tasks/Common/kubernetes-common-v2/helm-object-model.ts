import * as tl from 'azure-pipelines-task-lib/task';
import { IExecOptions, IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';

export interface NameValuePair {
    name: string;
    value: string;
}

export class Helm {
    private helmPath: string;
    private namespace: string;
    private version: string;

    constructor(kubectlPath: string, namespace?: string, version?: string) {
        this.helmPath = kubectlPath;
        this.version = version ? version : "2";
        if (!!namespace) {
            this.namespace = namespace;
        } else {
            this.namespace = 'default';
        }
    }

    public template(releaseName: string, chartPath: string, overrideFiles: string[], overrideValues: NameValuePair[]): IExecSyncResult {
        const command = tl.tool(this.helmPath);
        let args: string[] = [];
        args.push('template');

        if (!this.version.startsWith("3")) {
            args.push(chartPath);
            if (releaseName) {
                args.push('--name');
                args.push(releaseName);
            }
        } else {
            if (releaseName) {
                args.push(releaseName);
            }
            args.push(chartPath);
        }
        args.push('--namespace');
        args.push(this.namespace);
        if (overrideFiles.length > 0) {
            overrideFiles.forEach(file => {
                args.push('-f');
                args.push(file);
            });
        }
        args = args.concat(this._buildSetArguments(overrideValues));
        command.arg(args);
        // Printing the command explicitly because it gets masked when silent is set to true
        console.log(`[command] ${this.helmPath} ${args.join(' ') || ''}`);
        return command.execSync({ silent: true } as IExecOptions);
    }

    private _buildSetArguments(overrideValues: NameValuePair[]): string[] {
        const newArgs = [];
        overrideValues.forEach(overrideValue => {
            newArgs.push('--set');
            newArgs.push(`${overrideValue.name}=${overrideValue.value}`);
        });

        return newArgs;
    }
}