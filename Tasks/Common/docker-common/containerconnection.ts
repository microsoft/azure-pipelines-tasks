"use strict";

import * as del from "del";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import * as imageUtils from "./containerimageutils";
import AuthenticationToken from "./registryauthenticationprovider/registryauthenticationtoken"
import * as fileutils from "./fileutils";
import * as os from "os";

export default class ContainerConnection {
    private dockerPath: string;
    protected hostUrl: string;
    protected certsDir: string;
    private caPath: string;
    private certPath: string;
    private keyPath: string;
    private registryAuth: { [key: string]: string };
    private configurationDirPath: string;

    constructor() {
        this.dockerPath = tl.which("docker", true);
    }

    public createCommand(): tr.ToolRunner {
        var command = tl.tool(this.dockerPath);
        if (this.hostUrl) {
            command.arg(["-H", this.hostUrl]);
            command.arg("--tls");
            command.arg("--tlscacert='" + this.caPath + "'");
            command.arg("--tlscert='" + this.certPath + "'");
            command.arg("--tlskey='" + this.keyPath + "'");
        }
        return command;
    }

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

    public open(hostEndpoint?: string, authenticationToken?: AuthenticationToken): void {
        this.openHostEndPoint(hostEndpoint);
        this.openRegistryEndpoint(authenticationToken);
    }

    public qualifyImageName(imageName: string) {
        if (!imageUtils.hasRegistryComponent(imageName) && this.registryAuth) {
            var regUrl = url.parse(this.registryAuth["registry"]),
                hostname = !regUrl.slashes ? regUrl.href : regUrl.host;
            if (hostname.toLowerCase() !== "index.docker.io") {
                imageName = hostname + "/" + imageName;
            }
        }
        return imageName;
    }

    public close(): void {
        if (this.configurationDirPath && fs.existsSync(this.configurationDirPath)) {
            del.sync(this.configurationDirPath, {force: true});
        }
        if (this.certsDir && fs.existsSync(this.certsDir)) {
            del.sync(this.certsDir);
        }
    }
    
    private openHostEndPoint(hostEndpoint?: string): void {
        if (hostEndpoint) {
            this.hostUrl = tl.getEndpointUrl(hostEndpoint, false);
            if (this.hostUrl.charAt(this.hostUrl.length - 1) == "/") {
                this.hostUrl = this.hostUrl.substring(0, this.hostUrl.length - 1);
            }

            this.certsDir = path.join("", ".dockercerts");
            if (!fs.existsSync(this.certsDir)) {
                fs.mkdirSync(this.certsDir);
            }

            var authDetails = tl.getEndpointAuthorization(hostEndpoint, false).parameters;

            this.caPath = path.join(this.certsDir, "ca.pem");
            fs.writeFileSync(this.caPath, authDetails["cacert"]);

            this.certPath = path.join(this.certsDir, "cert.pem");
            fs.writeFileSync(this.certPath, authDetails["cert"]);

            this.keyPath = path.join(this.certsDir, "key.pem");
            fs.writeFileSync(this.keyPath, authDetails["key"]);
        }
    }
    
    protected openRegistryEndpoint(authenticationToken?: AuthenticationToken): void {
        
        if (authenticationToken) {     
            this.registryAuth = {};

            this.registryAuth["username"] = authenticationToken.getUsername();
            this.registryAuth["password"] = authenticationToken.getPassword();
            this.registryAuth["registry"] = authenticationToken.getLoginServerUrl();

            if (this.registryAuth) {
                this.configurationDirPath  = this.getDockerConfigDirPath();
                process.env["DOCKER_CONFIG"] = this.configurationDirPath;
                var json = authenticationToken.getDockerConfig();
                var configurationFilePath = path.join(this.configurationDirPath, "config.json");
                if(fileutils.writeFileSync(configurationFilePath, json) == 0)
                {
                    tl.error(tl.loc('NoDataWrittenOnFile', configurationFilePath));
                    throw new Error(tl.loc('NoDataWrittenOnFile', configurationFilePath));
                }
            }
        }
    }

    private getDockerConfigDirPath(): string {
        var configDir = path.join(this.getTempDirectory(), "DockerConfig_"+Date.now());
        this.ensureDirExists(configDir);
        return configDir;
    } 

    private ensureDirExists(dirPath : string) : void
    {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        }
    }

    private getTempDirectory(): string {
        return os.tmpdir();
    }
}
