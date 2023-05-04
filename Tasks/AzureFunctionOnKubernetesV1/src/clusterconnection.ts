"use strict";

import * as fs from "fs";
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";
import * as utils from "./utils/utilities";
import * as toolLib from 'azure-pipelines-tool-lib/tool';

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
        if(connectionType === "Azure Resource Manager") {
            return require("./clusters/armkubernetescluster");
        }
        else {
            return require("./clusters/generickubernetescluster");
        }
    }
    
    // get kubeconfig file path
    private async getKubeConfig(connectionType): Promise<string> {
        return this.loadClusterType(connectionType).getKubeConfig().then((config) => {
            return config;
        });
    }

    private async initialize(): Promise<void> {
        // prepend the tools path. instructs the agent to prepend for future tasks
        if(!process.env['PATH'].toLowerCase().startsWith(path.dirname(this.kubectlPath.toLowerCase()))) {
            toolLib.prependPath(path.dirname(this.kubectlPath));
        }
    }

    public createCommand(): tr.ToolRunner {
        var command = tl.tool(this.kubectlPath);
        return command;
    }

    // open kubernetes connection
    public async open() {
        var connectionType = tl.getInput("connectionType", true);
        console.log("Connection type: " + connectionType);
        if (connectionType === "None") {
            return this.initialize();
        }
        var kubeconfig;
        if (!this.kubeconfigFile) {
            kubeconfig = await this.getKubeConfig(connectionType);
        }

        return this.initialize().then(() => {
            if (kubeconfig)
            {
                this.kubeconfigFile = path.join(this.userDir, "config");
                fs.writeFileSync(this.kubeconfigFile, kubeconfig);
            }

            process.env["KUBECONFIG"] = this.kubeconfigFile;
         });
    }

    // close kubernetes connection
    public close(): void {
        var connectionType = tl.getInput("connectionType", true);
        if (connectionType === "None") {
            return;
        }
        if (this.kubeconfigFile != null && fs.existsSync(this.kubeconfigFile))
        {
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

        tl.debug(tl.loc('CallToolRunnerExec'));
        
        let promise = command.exec(options)
        .fail(error => {
            tl.debug(tl.loc('ToolRunnerExecCallFailed', error));
            errlines.forEach(line => tl.error(line));
            throw error;
        })
        .then(() => {
            tl.debug(tl.loc('ToolRunnerExecCallSucceeded'));
        });

        tl.debug(tl.loc('ReturningToolRunnerExecPromise'));
        return promise;
    }
}
