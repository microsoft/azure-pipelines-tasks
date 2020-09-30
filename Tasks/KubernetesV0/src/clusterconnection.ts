"use strict";

import * as fs from "fs";
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";
import * as utils from "./utilities";
import * as os from "os";
import kubectlutility = require("azure-pipelines-tasks-kubernetes-common-v2/kubectlutility");

export default class ClusterConnection {
    private kubectlPath: string;
    private kubeconfigFile: string;
    private userDir: string;

    constructor() {
        this.kubectlPath = tl.which("kubectl", false);
        this.userDir = utils.getNewUserDirPath();
    }

    private async initialize(): Promise<void> {
        return this.getKubectl().then((kubectlpath)=> {
            this.kubectlPath = kubectlpath;
        });
    }

    public createCommand(): tr.ToolRunner {
        var command = tl.tool(this.kubectlPath);
        if(this.kubeconfigFile)
        {
            command.arg("--kubeconfig");
            command.arg(this.kubeconfigFile);
        }
        return command;
    }

    // open kubernetes connection
    public async open(kubernetesEndpoint?: string){
         return this.initialize().then(() => {
            var authorizationType = tl.getEndpointDataParameter(kubernetesEndpoint, 'authorizationType', true);
            var kubeconfig = null;
            if (!authorizationType || authorizationType === "Kubeconfig")
            {
                if (kubernetesEndpoint) {
                     kubeconfig = kubectlutility.getKubeconfigForCluster(kubernetesEndpoint);
                } 
            }
            else if (authorizationType === "ServiceAccount" || authorizationType === "AzureSubscription")
            {
                kubeconfig = kubectlutility.createKubeconfig(kubernetesEndpoint);
            }
            
            this.kubeconfigFile = path.join(this.userDir, "config");
            fs.writeFileSync(this.kubeconfigFile, kubeconfig);
         });
    }

    // close kubernetes connection
    public close(): void {
        // all configuration are in agent temp directory. Hence automatically deleted.
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

    private getExecutableExtention(): string {
        if(os.type().match(/^Win/)){
            return ".exe";
        }

        return "";
    }

    private async getKubectl() : Promise<string> {
        let versionOrLocation = tl.getInput("versionOrLocation");
        if( versionOrLocation === "location") {
            let pathToKubectl = tl.getPathInput("specifyLocation", true, true);
            try {
                fs.chmodSync(pathToKubectl, "777");
            } catch (ex) {
                tl.debug(`Could not chmod ${pathToKubectl}, exception: ${JSON.stringify(ex)}`)
            }
            return pathToKubectl;
        }
        else if(versionOrLocation === "version") {
            var defaultVersionSpec = "1.7.0";
            var kubectlPath = path.join(this.userDir, "kubectl") + this.getExecutableExtention();
            let versionSpec = tl.getInput("versionSpec");
            let checkLatest: boolean = tl.getBoolInput('checkLatest', false);

            if (versionSpec != defaultVersionSpec || checkLatest)
            {
                tl.debug(tl.loc("DownloadingClient"));
                return utils.getKubectlVersion(versionSpec, checkLatest).then((version) => {
                    return utils.downloadKubectl(version, kubectlPath);
                });
            }

            // Reached here => default version
            // Now to handle back-compat, return the version installed on the machine
            if(this.kubectlPath && fs.existsSync(this.kubectlPath))
            {
                return this.kubectlPath;
            }

             // Download the default version
             tl.debug(tl.loc("DownloadingClient"));
             return utils.getKubectlVersion(versionSpec, checkLatest).then((version) => {
                return utils.downloadKubectl(version, kubectlPath);
            });
        }
    }
}