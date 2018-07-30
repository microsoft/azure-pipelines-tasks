"use strict";

import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import AuthenticationToken from "docker-common/registryauthenticationprovider/registryauthenticationtoken"
import * as utils from "./utilities";
import * as os from "os";
import kubectlutility = require("utility-common/kubectlutility");

export default class ClusterConnection {
    private kubectlPath: string;
    private kubeconfigFile: string;
    private userDir: string;

    constructor() {
        this.kubectlPath = tl.which("kubectl", false);
        this.userDir = utils.getNewUserDirPath();
    }

    private async initialize(): Promise<void> {
        if(!this.kubectlPath || !fs.existsSync(this.kubectlPath))
        {
            return this.getKubectl().then((kubectlpath)=> {
                this.kubectlPath = kubectlpath;
            });
        }
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
            if (authorizationType == null || authorizationType === "Kubeconfig")
            {
                if (kubernetesEndpoint) {
                     kubeconfig = tl.getEndpointAuthorizationParameter(kubernetesEndpoint, 'kubeconfig', false);
                } 
            }
            else if (authorizationType === "ServiceAccount")
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
        return command.exec(options).fail(error => {
            errlines.forEach(line => tl.error(line));
            throw error;
        });
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
            fs.chmod(pathToKubectl, "777");
            return pathToKubectl;
        }
        else if(versionOrLocation === "version") {
            tl.debug(tl.loc("DownloadingClient"));
            var kubectlPath = path.join(this.userDir, "kubectl") + this.getExecutableExtention();
            let versionSpec = tl.getInput("versionSpec");
            let checkLatest: boolean = tl.getBoolInput('checkLatest', false);
            return utils.getKubectlVersion(versionSpec, checkLatest).then((version) => {
                return utils.downloadKubectl(version, kubectlPath);
            })
        }
    }
}