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
    private oldDockerConfigContent: string;

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
        let errlines = [];
        let dockerHostVar = tl.getVariable("DOCKER_HOST");
        if (dockerHostVar) {
            tl.debug(tl.loc('ConnectingToDockerHost', dockerHostVar));
        }

        command.on("errline", line => {
            errlines.push(line);
        });
        return command.exec(options).fail(error => {            
            if (dockerHostVar) {
                tl.warning(tl.loc('DockerHostVariableWarning', dockerHostVar));
            }

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

    public getQualifiedImageName(repository: string, enforceDockerNamingConvention?: boolean): string {
        let imageName = repository ? repository : "";
        if (repository && this.registryAuth) {
            imageName = this.prefixRegistryIfRequired(this.registryAuth["registry"], repository);
        }

        return enforceDockerNamingConvention ? imageUtils.generateValidImageName(imageName) : imageName;
    }

    public getQualifiedImageNamesFromConfig(repository: string, enforceDockerNamingConvention?: boolean) {
        let imageNames: string[] = [];
        if (repository) {
            let regUrls = this.getRegistryUrlsFromDockerConfig();
            if (regUrls && regUrls.length > 0) {
                regUrls.forEach(regUrl => {
                    let imageName = this.prefixRegistryIfRequired(regUrl, repository);
                    if (enforceDockerNamingConvention) {
                        imageName = imageUtils.generateValidImageName(imageName);
                    }
                    
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
            this.unsetEnvironmentVariable();
            del.sync(dockerConfigPath, {force: true});
        }    
    }

    private logout() {
        // If registry info is present, remove auth for only that registry. (This can happen for any command - build, push, logout etc.)
        // Else, remove all auth data. (This would happen only in case of logout command. For other commands, logout is not called.)
        let registry = this.registryAuth ? this.registryAuth["registry"] : "";
        if (registry) {
            tl.debug(tl.loc('LoggingOutFromRegistry', registry));
            let existingConfigurationFile = this.getExistingDockerConfigFilePath();

            if (existingConfigurationFile) {
                if (this.oldDockerConfigContent) {
                    // restore the old docker config, cached in connection.open()
                    tl.debug(tl.loc('RestoringOldLoginAuth', registry));
                    this.writeDockerConfigJson(this.oldDockerConfigContent, existingConfigurationFile);
                }
                else {                    
                    let existingConfigJson = this.getDockerConfigJson(existingConfigurationFile);
                    if (existingConfigJson && existingConfigJson.auths && existingConfigJson.auths[registry]) {
                        if (Object.keys(existingConfigJson.auths).length > 1) {
                            // if the config contains other auths, then delete only the auth entry for the registry
                            tl.debug(tl.loc('FoundLoginsForOtherRegistries', registry));                        
                            delete existingConfigJson.auths[registry];
                            let dockerConfigContent = JSON.stringify(existingConfigJson);
                            tl.debug(tl.loc('DeletingAuthDataFromDockerConfig', registry, dockerConfigContent));
                            this.writeDockerConfigJson(dockerConfigContent, existingConfigurationFile);
                        }
                        else {
                            // if no other auth data is present, delete the config file and unset the DOCKER_CONFIG variable
                            tl.debug(tl.loc('DeletingDockerConfigDirectory', existingConfigurationFile));
                            this.removeConfigDirAndUnsetEnvVariable();
                        }
                    }
                    else {
                        // trying to logout from a registry where no login was done. Nothing to be done here.
                        tl.debug(tl.loc('RegistryAuthNotPresentInConfig', registry));
                    }
                }
            }
            else {
                // should not come to this in a good case, since when registry is provided, we are adding docker config
                // to a temp directory and setting DOCKER_CONFIG variable to its path.
                tl.debug(tl.loc('CouldNotFindDockerConfig', this.configurationDirPath));
                this.unsetEnvironmentVariable();
            }
        }        
        // unset the docker config env variable, and delete the docker config file (if present)
        else {
            tl.debug(tl.loc('LoggingOutWithNoRegistrySpecified'));
            this.removeConfigDirAndUnsetEnvVariable();
        }
    }

    private removeConfigDirAndUnsetEnvVariable(): void {
        let dockerConfigDirPath = tl.getVariable("DOCKER_CONFIG");
        if (dockerConfigDirPath && this.isPathInTempDirectory(dockerConfigDirPath) && fs.existsSync(dockerConfigDirPath)) {
            tl.debug(tl.loc('DeletingDockerConfigDirectory', dockerConfigDirPath));
            del.sync(dockerConfigDirPath, {force: true});
        }
        
        this.unsetEnvironmentVariable();
    }

    private unsetEnvironmentVariable(): void {
        tl.setVariable("DOCKER_CONFIG", "");        
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
        this.oldDockerConfigContent = null;
        if (authenticationToken) {     
            this.registryAuth = {};

            this.registryAuth["username"] = authenticationToken.getUsername();
            this.registryAuth["password"] = authenticationToken.getPassword();
            this.registryAuth["registry"] = authenticationToken.getLoginServerUrl();

            // don't add auth data to config file if doNotAddAuthToConfig is true.
            // In this case we only need this.registryAuth to be populated correctly (to logout from this particular registry when close() is called) but we don't intend to login.
            if (this.registryAuth && !doNotAddAuthToConfig) {
                let existingConfigurationFile = this.getExistingDockerConfigFilePath();

                if (multipleLoginSupported && existingConfigurationFile) {
                    let existingConfigJson = this.getDockerConfigJson(existingConfigurationFile);
                    if (existingConfigJson && existingConfigJson.auths) {
                        let newAuth = authenticationToken.getDockerAuth();
                        let newAuthJson = JSON.parse(newAuth);
                        // Think of json object as a dictionary and authJson looks like 
                        //      "auths": {
                        //          "aj.azurecr.io": {
                        //              "auth": "***",
                        //              "email": "***"
                        //          }
                        //      }
                        //    key will be aj.azurecr.io
                        //
                        for (let registryName in newAuthJson) {
                            
                            // If auth is already present for the same registry, then cache it so that we can 
                            // preserve it back on logout. 
                            if (existingConfigJson.auths[registryName]) {
                                this.oldDockerConfigContent = JSON.stringify(existingConfigJson);
                                tl.debug(tl.loc('OldDockerConfigContent', this.oldDockerConfigContent));
                            }

                            existingConfigJson.auths[registryName] = newAuthJson[registryName];
                            tl.debug(tl.loc('AddingNewAuthToExistingConfig', registryName));
                        }

                        let dockerConfigContent = JSON.stringify(existingConfigJson);
                        this.writeDockerConfigJson(dockerConfigContent, existingConfigurationFile);
                    }
                }
                else {
                    var json = authenticationToken.getDockerConfig();
                    this.writeDockerConfigJson(json);
                }                
            }
        }
    }

    private getExistingDockerConfigFilePath(): string {
        this.configurationDirPath = tl.getVariable("DOCKER_CONFIG");
        let configurationFilePath = this.configurationDirPath ? path.join(this.configurationDirPath, "config.json") : "";                
        if (this.configurationDirPath && this.isPathInTempDirectory(configurationFilePath) && fs.existsSync(configurationFilePath)) {
            return configurationFilePath;
        }

        return null;
    }

    private getDockerConfigJson(configurationFilePath : string): any {
        let configJson: any;
        let dockerConfig = fs.readFileSync(configurationFilePath, "utf-8");
        tl.debug(tl.loc('FoundDockerConfigStoredInTempPath', configurationFilePath, dockerConfig));
        try {
            configJson = JSON.parse(dockerConfig);
        }
        catch(err) {
            let errorMessage = tl.loc('ErrorParsingDockerConfig', err);
            throw new Error(errorMessage);
        }

        return configJson;
    }

    private writeDockerConfigJson(dockerConfigContent: string, configurationFilePath?: string): void {
        if (!configurationFilePath){
            this.configurationDirPath  = this.getDockerConfigDirPath();
            process.env["DOCKER_CONFIG"] = this.configurationDirPath;
            configurationFilePath = path.join(this.configurationDirPath, "config.json");    
        }
    
        tl.debug(tl.loc('WritingDockerConfigToTempFile', configurationFilePath, dockerConfigContent));
        if(fileutils.writeFileSync(configurationFilePath, dockerConfigContent) == 0) {
            tl.error(tl.loc('NoDataWrittenOnFile', configurationFilePath));
            throw new Error(tl.loc('NoDataWrittenOnFile', configurationFilePath));
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
        let existingConfigurationFile = this.getExistingDockerConfigFilePath();
        if (existingConfigurationFile) {            
            let existingConfigJson = this.getDockerConfigJson(existingConfigurationFile);
            if (existingConfigJson && existingConfigJson.auths) {
                regUrls = Object.keys(existingConfigJson.auths);
            }
            else {
                tl.debug(tl.loc('NoAuthInfoFoundInDockerConfig'));
            }
        }
        else {
            tl.debug(tl.loc('CouldNotFindDockerConfig', this.configurationDirPath));
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
