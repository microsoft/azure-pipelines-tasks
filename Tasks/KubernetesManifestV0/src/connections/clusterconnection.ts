"use strict";

import * as fs from "fs";
import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import * as utils from "../utilities";

export default class ClusterConnection {
    private kubectlPath: string;
    private kubeconfigFile: string;
    private userDir: string;

    constructor(existingKubeConfigPath?: string) {
        this.kubectlPath = tl.which("kubectl", false);
        this.userDir = utils.getNewUserDirPath();
        if (existingKubeConfigPath) {
            this.kubeconfigFile = existingKubeConfigPath;
        }
    }

    private loadClusterType(connectionType: string): any {
        if (connectionType === "Azure Resource Manager") {
            return require("./armkubernetescluster");
        }
        else {
            return require("./generickubernetescluster");
        }
    }

    // get kubeconfig file path
    private async getKubeConfig(connectionType): Promise<string> {
        return this.loadClusterType(connectionType)
            .getKubeConfig().then((config) => {
                return config;
            });
    }

    // open kubernetes connection
    public async login() {
        var connectionType = tl.getInput("connectionType", true);
        if (connectionType === "None") {
            return;
        }
        var kubeconfig;
        if (!this.kubeconfigFile) {
            kubeconfig = await this.getKubeConfig(connectionType);
        }

        if (kubeconfig) {
            this.kubeconfigFile = path.join(this.userDir, "config");
            fs.writeFileSync(this.kubeconfigFile, kubeconfig);
        }

        process.env["KUBECONFIG"] = this.kubeconfigFile;
    }

    // close kubernetes connection
    public close(skip?: boolean): void {
        var connectionType = tl.getInput("connectionType", true);
        if (!!skip || connectionType === "None") {
            return;
        }
        if (this.kubeconfigFile != null && fs.existsSync(this.kubeconfigFile)) {
            delete process.env["KUBECONFIG"];
            fs.unlinkSync(this.kubeconfigFile);
        }
    }

    public setKubeConfigEnvVariable() {
        if (this.kubeconfigFile && fs.existsSync(this.kubeconfigFile)) {
            tl.setVariable("KUBECONFIG", this.kubeconfigFile);
        }
        else {
            tl.error(tl.loc('KubernetesServiceConnectionNotFound'));
            throw new Error(tl.loc('KubernetesServiceConnectionNotFound'));
        }
    }

    public unsetKubeConfigEnvVariable() {
        var kubeConfigPath = tl.getVariable("KUBECONFIG");
        if (kubeConfigPath) {
            tl.setVariable("KUBECONFIG", "");
        }
    }

    //excute kubernetes command
    public execCommand(command: tr.ToolRunner, options?: tr.IExecOptions) {
        var errlines = [];
        command.on("errline", line => {
            errlines.push(line);
        });
        return command.exec(options).fail(error => {
            errlines.forEach(line => tl.error(line));
            throw error;
        });
    }
}
