import tl = require('vsts-task-lib/task');
import { IExecOptions, IExecSyncResult, IExecSyncOptions } from 'vsts-task-lib/toolrunner';

export class Kubectl {
    private kubectlPath: string;
    private namespace: string;

    constructor(kubectlPath: string, namespace?: string) {
        this.kubectlPath = kubectlPath;
        if (!!namespace) {
            this.namespace = namespace;
        }
        else {
            this.namespace = "default";
        }
    }

    public apply(configurationPath: string): IExecSyncResult {
        var command = tl.tool(this.kubectlPath);
        command.arg("apply");
        command.arg(["-f", configurationPath]);
        command.arg(["--namespace", this.namespace]);
        return command.execSync();
    }

    public annotate(type: string, value: string, annotations: string[], overwrite?: boolean): IExecSyncResult {
        var command = tl.tool(this.kubectlPath);
        command.arg("annotate");
        command.arg([type, value]);
        command.arg(["--namespace", this.namespace]);
        command.arg(annotations);
        if (!!overwrite) command.arg(`--overwrite`)
        return command.execSync();
    }

    public getNewReplicaSet(deployment): string {
        var command = tl.tool(this.kubectlPath);
        command.arg("describe");
        command.arg(["deployment", deployment]);
        command.arg(["--namespace", this.namespace]);
        let stdout = command.execSync({ silent: true } as IExecOptions).stdout.split("\n");
        let newReplicaSet = "";
        stdout.forEach((line: string) => {
            if (line.indexOf("newreplicaset") > -1) {
                newReplicaSet = line.substr(14).trim().split(" ")[0];
            }
        });

        return newReplicaSet;
    }

    public getAllPods(): IExecSyncResult {
        var command = tl.tool(this.kubectlPath);
        command.arg("get");
        command.arg("pods");
        command.arg(["--namespace", this.namespace]);
        command.arg(["-o", "json"])
        return command.execSync({ silent: true } as IExecSyncOptions);
    }

    public checkRolloutStatus(resourceType, name): IExecSyncResult {
        var command = tl.tool(this.kubectlPath);
        command.arg(["rollout", "status"]);
        command.arg(resourceType + "/" + JSON.parse(name));
        command.arg(["--namespace", this.namespace]);
        return command.execSync();
    }

}