"use strict";

import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import * as toolLib from 'vsts-task-tool-lib/tool';
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

    private getClusterType(): any {
        var connectionType = tl.getInput("connectionType", true);
        if(connectionType === "Azure Resource Manager") {
            return require("./clusters/armkubernetescluster")  
        }
        
        return require("./clusters/generickubernetescluster")
    }
    
    // get kubeconfig file path
    private async getKubeConfig(): Promise<string> {
        return this.getClusterType().getKubeConfig().then((config) => {
            return config;
        });
    }

    private async initialize(): Promise<void> {
        if(!this.kubectlPath || !fs.existsSync(this.kubectlPath))
        {
            return this.getKubectl().then((kubectlpath)=> {
                this.kubectlPath = kubectlpath; 
                // prepend the tools path. instructs the agent to prepend for future tasks
                if(!process.env['PATH'].startsWith(path.dirname(this.kubectlPath))) {
                    toolLib.prependPath(path.dirname(this.kubectlPath));
                }             
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
    public async open(){
        var kubeconfig = await this.getKubeConfig();
         return this.initialize().then(() => {
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

    // download kubernetes cluster config file from endpoint
    private downloadKubeconfigFileFromEndpoint(kubernetesEndpoint: string) : void {
        this.kubeconfigFile = path.join(this.userDir, "config");
        var kubeconfig = tl.getEndpointAuthorizationParameter(kubernetesEndpoint, 'kubeconfig', false);
        fs.writeFileSync(this.kubeconfigFile, kubeconfig);
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
            let versionSpec = tl.getInput("versionSpec");
            let checkLatest: boolean = tl.getBoolInput('checkLatest', false);
            var version = await utils.getKubectlVersion(versionSpec, checkLatest);
            return await utils.downloadKubectl(version);                 
        }
    }
}