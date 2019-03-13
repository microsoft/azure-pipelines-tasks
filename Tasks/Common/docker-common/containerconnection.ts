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
    private isPreviouslyLoggedIn: boolean;
    private previousLoginAuthData: string;

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

    public open(hostEndpoint?: string, authenticationToken?: AuthenticationToken, multipleLoginSupported?: boolean, doNotAddAuthToConfig?: boolean): void {
        this.openHostEndPoint(hostEndpoint);
        this.openRegistryEndpoint(authenticationToken, multipleLoginSupported, doNotAddAuthToConfig);
    }

    public getQualifiedImageNameIfRequired(imageName: string) {
        if (!imageUtils.hasRegistryComponent(imageName)) {
            imageName = this.getQualifiedImageName(imageName);
        }

        return imageName;
    }

    public getQualifiedImageName(repository: string): string {
        let imageName = repository ? repository : "";
        if (repository && this.registryAuth) {
            imageName = this.prefixRegistryIfRequired(this.registryAuth["registry"], repository);
        }

        return imageName;
    }

    public getQualifiedImageNamesFromConfig(repository: string) {
        let imageNames: string[] = [];
        if (repository) {
            let regUrls = this.getRegistryUrlsFromDockerConfig();
            if (regUrls && regUrls.length > 0) {
                regUrls.forEach(regUrl => {
                    let imageName = this.prefixRegistryIfRequired(regUrl, repository);
                    imageNames.push(imageName);
                });
            }
        }

        return imageNames;
    }

    public close(multipleLoginSupported?: boolean, command?: string): void {
        if (multipleLoginSupported) {
            if (this.isLogoutRequired(command)) {
                this.logout();
            }
        }
        else {
            if (this.configurationDirPath && fs.existsSync(this.configurationDirPath)) {
                del.sync(this.configurationDirPath, {force: true});
            }
            if (this.certsDir && fs.existsSync(this.certsDir)) {
                del.sync(this.certsDir);
            }
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

    private logout() {
        // Remove auth for registry if specified.
        // Remove all auth data if no registry is specified.
        let registry = this.registryAuth ? this.registryAuth["registry"] : "";
        if (registry) {
            tl.debug(tl.loc('LoggingOutFromRegistry', registry));
            let dockerConfigDirPath = tl.getVariable("DOCKER_CONFIG");
            let dockerConfigFilePath = dockerConfigDirPath ? path.join(dockerConfigDirPath, "config.json") : "";

            if (dockerConfigDirPath && this.isPathInTempDirectory(dockerConfigFilePath) && fs.existsSync(dockerConfigFilePath)) {
                let dockerConfig = fs.readFileSync(dockerConfigFilePath, "utf-8");
                tl.debug(tl.loc('FoundDockerConfigStoredInTempPath', dockerConfigFilePath, dockerConfig));
                let configJson = JSON.parse(dockerConfig);

                if (configJson && configJson.auths && configJson.auths[registry]) {
                    if (this.isPreviouslyLoggedIn) {
                        tl.debug(tl.loc('FoundPreviousLogin', registry));
                        let loggedInAuthData = JSON.parse(this.previousLoginAuthData);
                        configJson.auths[registry] = loggedInAuthData;                        
                        let configString = JSON.stringify(configJson);
                        tl.debug(tl.loc('RestoringPreviousLoginAuth', configString));
                        if(fileutils.writeFileSync(dockerConfigFilePath, configString) == 0)
                        {
                            tl.error(tl.loc('NoDataWrittenOnFile', dockerConfigFilePath));
                            throw new Error(tl.loc('NoDataWrittenOnFile', dockerConfigFilePath));
                        }
                    }
                    else if (Object.keys(configJson.auths).length > 1) {
                        // if the config contains other auths, then delete only the auth entry for the registry
                        tl.debug(tl.loc('FoundLoginsForOtherRegistries', registry));                        
                        delete configJson.auths[registry];
                        let configString = JSON.stringify(configJson);
                        tl.debug(tl.loc('DeletingAuthDataFromDockerConfig', registry, configString));
                        if(fileutils.writeFileSync(dockerConfigFilePath, configString) == 0)
                        {
                            tl.error(tl.loc('NoDataWrittenOnFile', dockerConfigFilePath));
                            throw new Error(tl.loc('NoDataWrittenOnFile', dockerConfigFilePath));
                        }
                    }
                    else {
                        // if no other auth data is present, delete the config file and unset the DOCKER_CONFIG variable
                        tl.debug(tl.loc('DeletingDockerConfigDirectory', dockerConfigDirPath));
                        del.sync(dockerConfigDirPath, {force: true});
                        tl.setVariable("DOCKER_CONFIG", "");
                    }
                }
                else {
                    // trying to logout from a registry where no login was done. Nothing to be done here.
                    tl.debug(tl.loc('RegistryAuthNotPresentInConfig', registry, dockerConfig));
                }
            }
            else {
                // should not come to this in a good case. We are setting DOCKER_CONFIG to the temp directory path in open().
                tl.debug(tl.loc('CouldNotFindDockerConfig', dockerConfigDirPath, dockerConfigFilePath));
                tl.setVariable("DOCKER_CONFIG", "");
            }
        }        
        // unset the docker config env variable, and delete the docker config file (if present)
        else {
            tl.debug(tl.loc('LoggingOutWithNoRegistrySpecified'));
            let dockerConfigDirPath = tl.getVariable("DOCKER_CONFIG");
            if (dockerConfigDirPath && this.isPathInTempDirectory(dockerConfigDirPath) && fs.existsSync(dockerConfigDirPath)) {
                tl.debug(tl.loc('DeletingDockerConfigDirectory', dockerConfigDirPath));
                del.sync(dockerConfigDirPath, {force: true});
            }
            
            tl.setVariable("DOCKER_CONFIG", "");
        }
    }

    private isLogoutRequired(command: string): boolean {
        return command === "logout" || (this.registryAuth && !!this.registryAuth["registry"]);
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
    
    protected openRegistryEndpoint(authenticationToken?: AuthenticationToken, multipleLoginSupported?: boolean, doNotAddAuthToConfig?: boolean): void {        
        this.isPreviouslyLoggedIn = false;
        if (authenticationToken) {     
            this.registryAuth = {};

            this.registryAuth["username"] = authenticationToken.getUsername();
            this.registryAuth["password"] = authenticationToken.getPassword();
            this.registryAuth["registry"] = authenticationToken.getLoginServerUrl();

            // don't add auth data to config file if doNotAddAuthToConfig is true.
            // In this case we only need this.registryAuth to be populated correctly (to logout from this particular registry when close() is called) but we don't intend to login.
            if (this.registryAuth && !doNotAddAuthToConfig) {
                this.configurationDirPath = tl.getVariable("DOCKER_CONFIG");
                let configurationFilePath = this.configurationDirPath ? path.join(this.configurationDirPath, "config.json") : "";                
                if (multipleLoginSupported && this.configurationDirPath && this.isPathInTempDirectory(configurationFilePath) && fs.existsSync(configurationFilePath)) {
                    let dockerConfig = fs.readFileSync(configurationFilePath, "utf-8");
                    tl.debug(tl.loc('FoundDockerConfigStoredInTempPath', configurationFilePath, dockerConfig));
                    let configJson = JSON.parse(dockerConfig);
                    if (configJson && configJson.auths) {
                        let auth = JSON.parse(authenticationToken.getDockerAuth());
                        for (let key in auth) {
                            if (configJson.auths[key]) {
                                this.isPreviouslyLoggedIn = true;
                                this.previousLoginAuthData = JSON.stringify(configJson.auths[key]);
                                tl.debug(tl.loc('FoundPreviousLoginForRegistry', this.previousLoginAuthData));
                            }

                            configJson.auths[key] = auth[key];
                        }

                        let configString = JSON.stringify(configJson);
                        tl.debug(tl.loc('AddingAuthDataToDockerConfig', this.registryAuth["registry"], configString));
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
        let dockerConfigDirPath = tl.getVariable("DOCKER_CONFIG");
        let dockerConfigFilePath = dockerConfigDirPath ? path.join(dockerConfigDirPath, "config.json") : "";
        if (dockerConfigDirPath && this.isPathInTempDirectory(dockerConfigFilePath) && fs.existsSync(dockerConfigFilePath)) {
            let dockerConfig = fs.readFileSync(dockerConfigFilePath, "utf-8");
            tl.debug(tl.loc('FoundDockerConfigStoredInTempPath', dockerConfigFilePath, dockerConfig));
            let configJson = JSON.parse(dockerConfig);
            if (configJson && configJson.auths) {
                regUrls = Object.keys(configJson.auths);
            }
        }
        else {
            tl.debug(tl.loc('CouldNotFindDockerConfig', dockerConfigDirPath, dockerConfigFilePath));
        }

        return regUrls;
    }

    private isPathInTempDirectory(path): boolean {
        let tempDir = this.getTempDirectory();
        let result = path && path.startsWith(tempDir);
        if (!result) {
            tl.debug(tl.loc('PathIsNotInTempDirectory', path, tempDir));
        }

        return result;
    }

    private prefixRegistryIfRequired(registry: string, repository: string): string {
        let imageName = repository;

        if (registry) {
            let regUrl = url.parse(registry);
            let hostname = !regUrl.slashes ? regUrl.href : regUrl.host;
            // For docker hub, repository name is the qualified image name. Prepend hostname if the registry is not docker hub.
            if (hostname.toLowerCase() !== "index.docker.io") {
                imageName = hostname + "/" + repository;
            }
        }

        return imageName;
    }
}
