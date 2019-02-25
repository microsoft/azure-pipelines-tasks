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

    public open(hostEndpoint?: string, authenticationToken?: AuthenticationToken, allowMultipleLogin?: boolean): void {
        this.openHostEndPoint(hostEndpoint);
        this.openRegistryEndpoint(authenticationToken, allowMultipleLogin);
    }

    public qualifyImageName(imageName: string) {
        if (!imageUtils.hasRegistryComponent(imageName) && this.registryAuth) {
            imageName = this.prefixImageName(this.registryAuth["registry"], imageName);
        }

        return imageName;
    }

    public getQualifiedImageName(repository: string) {
        let imageName = "";
        if (repository) {
            imageName = this.prefixImageName(this.registryAuth["registry"], repository);
        }

        return imageName;
    }

    public getQualifiedImageNamesFromConfig(repository: string) {
        let imageNames: string[] = [];
        if (repository) {
            let regUrls = this.getRegistryUrlsFromDockerConfig();
            if (regUrls && regUrls.length > 0) {
                regUrls.forEach(regUrl => {
                    let imageName = this.prefixImageName(regUrl, repository);
                    imageNames.push(imageName);
                });
            }
        }

        return imageNames;
    }

    public close(): void {
        if (this.configurationDirPath && fs.existsSync(this.configurationDirPath)) {
            del.sync(this.configurationDirPath, {force: true});
        }
        if (this.certsDir && fs.existsSync(this.certsDir)) {
            del.sync(this.certsDir);
        }
    }
    
    public setDockerConfigEnvVariable() {
        if (this.configurationDirPath && fs.existsSync(this.configurationDirPath)) {
            tl.setVariable("DOCKER_CONFIG", this.configurationDirPath, true);
        }
        else {
            tl.error(tl.loc('DockerRegistryNotFound'));
            throw new Error(tl.loc('DockerRegistryNotFound'));
        }
    }
    
    public unsetDockerConfigEnvVariable() {
        var dockerConfigPath = tl.getVariable("DOCKER_CONFIG");
        if (dockerConfigPath) {
            tl.setVariable("DOCKER_CONFIG", "");
            del.sync(dockerConfigPath, {force: true});
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
    
    protected openRegistryEndpoint(authenticationToken?: AuthenticationToken, allowMultipleLogin?: boolean): void {
        
        if (authenticationToken) {     
            this.registryAuth = {};

            this.registryAuth["username"] = authenticationToken.getUsername();
            this.registryAuth["password"] = authenticationToken.getPassword();
            this.registryAuth["registry"] = authenticationToken.getLoginServerUrl();

            if (this.registryAuth) {
                this.configurationDirPath = tl.getVariable("DOCKER_CONFIG");                
                let configurationFilePath = this.configurationDirPath ? path.join(this.configurationDirPath, "config.json") : "";                
                if (allowMultipleLogin && this.configurationDirPath && this.isPathInTempDirectory(configurationFilePath) && fs.existsSync(configurationFilePath)) {
                    let dockerConfig = fs.readFileSync(configurationFilePath, "utf-8");
                    let configJson = JSON.parse(dockerConfig);
                    if (configJson && configJson.auths) {
                        let auth = JSON.parse(authenticationToken.getDockerAuth());
                        for (let key in auth) {                            
                            configJson.auths[key] = auth[key];
                        }

                        let configString = JSON.stringify(configJson);
                        if(fileutils.writeFileSync(configurationFilePath, configString) == 0)
                        {
                            tl.error(tl.loc('NoDataWrittenOnFile', configurationFilePath));
                            throw new Error(tl.loc('NoDataWrittenOnFile', configurationFilePath));
                        }
                    }
                }
                else {
                    this.configurationDirPath  = this.getDockerConfigDirPath();
                    process.env["DOCKER_CONFIG"] = this.configurationDirPath;
                    var json = authenticationToken.getDockerConfig();
                    configurationFilePath = path.join(this.configurationDirPath, "config.json");
                    if(fileutils.writeFileSync(configurationFilePath, json) == 0)
                    {
                        tl.error(tl.loc('NoDataWrittenOnFile', configurationFilePath));
                        throw new Error(tl.loc('NoDataWrittenOnFile', configurationFilePath));
                    }
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
            var privateKeyDir= path.join(dirPath, "trust", "private");
            tl.mkdirP(privateKeyDir);
        }
    }

    private getTempDirectory(): string {
        return tl.getVariable('agent.tempDirectory') || os.tmpdir();
    }

    private getRegistryUrlsFromDockerConfig(): string[] {
        let regUrls: string[] = [];
        let dockerConfigDir = tl.getVariable("DOCKER_CONFIG");
        let dockerConfigPath = dockerConfigDir ? path.join(dockerConfigDir, "config.json") : "";
        if (dockerConfigDir && this.isPathInTempDirectory(dockerConfigPath) && fs.existsSync(dockerConfigPath)) {
            let dockerConfig = fs.readFileSync(dockerConfigPath, "utf-8");
            let configJson = JSON.parse(dockerConfig);
            if (configJson && configJson.auths) {
                regUrls = Object.keys(configJson.auths);
            }
        }

        return regUrls;
    }

    private isPathInTempDirectory(path): boolean {
        let tempDir = this.getTempDirectory();
        return path && path.startsWith(tempDir);
    }

    private prefixImageName(registry: string, repository: string): string {
        let regUrl = url.parse(registry);
        let hostname = !regUrl.slashes ? regUrl.href : regUrl.host;        
        let imageName = repository;
        // For docker hub, repository name is the qualified image name.
        if (hostname.toLowerCase() !== "index.docker.io") {
            imageName = hostname + "/" + repository;
        }

        return imageName;
    }
}
