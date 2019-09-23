import * as tl from 'azure-pipelines-task-lib/task';
import { IExecOptions, IExecSyncResult, ToolRunner } from 'azure-pipelines-task-lib/toolrunner';

export interface Resource {
    name: string;
    type: string;
}

export class Kubectl {
    private kubectlPath: string;
    private namespace: string;
    private ignoreSSLErrors: boolean;

    constructor(kubectlPath: string, namespace?: string, ignoreSSLErrors?: boolean) {
        this.kubectlPath = kubectlPath;
        this.ignoreSSLErrors = !!ignoreSSLErrors;
        if (!!namespace) {
            this.namespace = namespace;
        } else {
            this.namespace = 'default';
        }
    }

    public apply(configurationPaths: string | string[]): IExecSyncResult {
        const command = tl.tool(this.kubectlPath);
        command.arg('apply');
        command.arg(['-f', this.createInlineArray(configurationPaths)]);
        return this.execute(command);
    }

    public annotate(resourceType: string, resourceName: string, annotations: string[], overwrite?: boolean): IExecSyncResult {
        const command = tl.tool(this.kubectlPath);
        command.arg('annotate');
        command.arg([resourceType, resourceName]);
        command.arg(annotations);
        if (!!overwrite) { command.arg(`--overwrite`); }
        return this.execute(command);
    }

    public annotateFiles(files: string | string[], annotations: string[], overwrite?: boolean): IExecSyncResult {
        const command = tl.tool(this.kubectlPath);
        command.arg('annotate');
        command.arg(['-f', this.createInlineArray(files)]);
        command.arg(annotations);
        if (!!overwrite) { command.arg(`--overwrite`); }
        return this.execute(command);
    }

    public createDockerSecret(secretName: string, registryServer: string, userName: string, password: string, email: string, force?: boolean): IExecSyncResult {
        if (!!force && !!secretName) {
            this.deleteSecret(secretName);
        }

        const command = tl.tool(this.kubectlPath);
        command.arg('create');
        command.arg('secret');
        command.arg('docker-registry');
        command.arg(secretName);
        command.arg(['--docker-username', userName]);
        command.arg(['--docker-password', password]);
        command.arg(['--docker-server', registryServer]);
        command.arg(['--docker-email', email]);
        return this.execute(command);
    }

    public createGenericSecret(secretName: string, args: string, force?: boolean): IExecSyncResult {
        if (!!force && !!secretName) {
            this.deleteSecret(secretName);
        }

        const command = tl.tool(this.kubectlPath);
        command.arg('create');
        command.arg('secret');
        command.arg('generic');
        command.arg(secretName);
        if (args) {
            command.line(args);
        }

        return this.execute(command);
    }

    public describe(resourceType: string, resourceName: string, silent?: boolean): IExecSyncResult {
        const command = tl.tool(this.kubectlPath);
        command.arg('describe');
        command.arg([resourceType, resourceName]);
        return this.execute(command, silent);
    }

    public getNewReplicaSet(deployment: string): string {
        let newReplicaSet = '';
        const result = this.describe('deployment', deployment, true);
        if (result != null && result.stdout != null) {
            const stdout = result.stdout.split('\n');
            stdout.forEach((line: string) => {
                if (!!line && line.toLowerCase().indexOf('newreplicaset') > -1) {
                    newReplicaSet = line.substr(14).trim().split(' ')[0];
                }
            });
        }

        return newReplicaSet;
    }

    public getAllPods(): IExecSyncResult {
        const command = tl.tool(this.kubectlPath);
        command.arg('get');
        command.arg('pods');
        command.arg(['-o', 'json']);
        return this.execute(command, true);
    }

    public getClusterInfo(): IExecSyncResult {
        const command = tl.tool(this.kubectlPath);
        command.arg('cluster-info');
        return this.execute(command, true);
    }

    public checkRolloutStatus(resourceType: string, name: string): IExecSyncResult {
        const command = tl.tool(this.kubectlPath);
        command.arg(['rollout', 'status']);
        command.arg(resourceType + '/' + name);
        return this.execute(command);
    }

    public getResource(resourceType: string, name: string): IExecSyncResult {
        const command = tl.tool(this.kubectlPath);
        command.arg('get');
        command.arg(resourceType + '/' + name);
        command.arg(['-o', 'json']);
        return this.execute(command);
    }

    public getResources(applyOutput: string, filterResourceTypes: string[]): Resource[] {
        const outputLines = applyOutput.split('\n');
        const results = [];
        outputLines.forEach(line => {
            const words = line.split(' ');
            if (words.length > 2) {
                const resourceType = words[0].trim();
                const resourceName = JSON.parse(words[1].trim());
                if (filterResourceTypes.filter(type => !!type && resourceType.toLowerCase().startsWith(type.toLowerCase())).length > 0) {
                    results.push({
                        type: resourceType,
                        name: resourceName
                    } as Resource);
                }
            }
        });

        return results;
    }

    public scale(resourceType: string, resourceName: string, replicas: any) {
        const command = tl.tool(this.kubectlPath);
        command.arg('scale');
        command.arg(resourceType + '/' + resourceName);
        command.arg(`--replicas=${replicas}`);
        return this.execute(command);
    }

    public patch(resourceType: string, resourceName: string, patch: string, strategy: any) {
        const command = tl.tool(this.kubectlPath);
        command.arg('patch');
        command.arg([resourceType, resourceName]);
        command.arg(`--type=${strategy}`);
        command.arg([`-p`, patch]);
        return this.execute(command);
    }

    public delete(args: string) {
        const command = tl.tool(this.kubectlPath);
        command.arg('delete');
        command.line(args);
        return this.execute(command);
    }

    private execute(command: ToolRunner, silent?: boolean) {
        if (this.ignoreSSLErrors) {
            command.arg('--insecure-skip-tls-verify');
        }
        command.arg(['--namespace', this.namespace]);
        return command.execSync({ silent: !!silent } as IExecOptions);
    }

    private createInlineArray(str: string | string[]): string {
        if (typeof str === 'string') { return str; }
        return str.join(',');
    }

    private deleteSecret(secretName: string): void {
        const command = tl.tool(this.kubectlPath);
        command.arg('delete');
        command.arg('secret');
        command.arg(secretName);
        this.execute(command);
    }
}