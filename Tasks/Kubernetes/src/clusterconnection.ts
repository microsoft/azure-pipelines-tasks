"use strict";

import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import AuthenticationToken from "docker-common/registryauthenticationprovider/registryauthenticationtoken"
import * as utils from "./utilities";
import * as os from "os";

export default class ClusterConnection {
    private kubectlPath: string;
    private kubeconfigFile: string;
    private userDir: string;

    constructor() {
        this.kubectlPath = tl.which("kubectl", false);
        this.userDir = utils.getNewUserDirPath();
    }

    private async initialize() {
        if(!this.kubectlPath || !fs.existsSync(this.kubectlPath))
        {
            tl.debug("Downloading kubernetes client");
            this.kubectlPath = path.join(this.userDir, "kubectl") + this.getExtention();
            var version = await utils.getStableKubectlVersion();
            await utils.downloadKubectl(version, this.kubectlPath);
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
         await this.initialize();
         if (kubernetesEndpoint) {
            this.downloadKubeconfigFileFromEndpoint(kubernetesEndpoint);
         }
    }

    // close kubernetes connection
    public close(): void {
        // all configuration ase in agent temp directory. Hence automatically deleted.
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

    // download kubernetes cluster config file from endpoint
    private downloadKubeconfigFileFromEndpoint(kubernetesEndpoint: string) : void {
        this.kubeconfigFile = path.join(this.userDir, "config");
        var authDetails = tl.getEndpointAuthorization(kubernetesEndpoint, false).parameters;
        fs.writeFileSync(this.kubeconfigFile, authDetails["kubeconfig"]);
    }

    private getExtention(): string {
        if(os.type() === "Windows_NT"){
            return ".exe";
        }

        return "";
    }
}