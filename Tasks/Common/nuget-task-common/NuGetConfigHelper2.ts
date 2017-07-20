import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as Q from "q";
import * as tl from "vsts-task-lib/task";

import * as auth from "./Authentication";
import { IPackageSource } from "./Authentication";
import * as ngToolRunner from "./NuGetToolRunner2";

let xmlreader = require("xmlreader");

// NuGetConfigHelper2 handles authenticated scenarios where the user selects a source from the UI or from a service connection.
// It is used by the NuGetCommand >= v2.0.0 and DotNetCoreCLI >= v2.0.0

export class NuGetConfigHelper2 {
    public tempNugetConfigPath = undefined;

    constructor(
        private nugetPath: string,
        private nugetConfigPath: string,
        private authInfo: auth.NuGetExtendedAuthInfo,
        private environmentSettings: ngToolRunner.NuGetEnvironmentSettings,
        private tempConfigPath: string /*optional*/)
    {
        this.tempNugetConfigPath = tempConfigPath || this.getTempNuGetConfigPath();
    }

    public static getTempNuGetConfigBasePath() {
        return tl.getVariable("Agent.BuildDirectory")
        || tl.getVariable("Agent.ReleaseDirectory")
        || process.cwd();
     }

    public ensureTempConfigCreated() {
        // save nuget config file to agent build directory
        console.log(tl.loc("Info_SavingTempConfig"));
        
        let tempNuGetConfigDir = path.dirname(this.tempNugetConfigPath);
        if (!tl.exist(tempNuGetConfigDir)) {
            tl.mkdirP(tempNuGetConfigDir);
        }

        if (!tl.exist(this.tempNugetConfigPath))
        {
            if (this.nugetConfigPath) {
                // don't use cp as that copies the read-only flag, and tfvc sets that on files
                let content = fs.readFileSync(this.nugetConfigPath);
                tl.writeFile(this.tempNugetConfigPath, content);
            }
            else {
                // small file, use writeFileSync
                tl.writeFile(this.tempNugetConfigPath, "<configuration/>");
            }
        }
    }

    public addSourcesToTempNuGetConfig(packageSources: IPackageSource[]): void
    {
        tl.debug('Adding sources to nuget.config');
        this.ensureTempConfigCreated();
        this.addSourcesToTempNugetConfigInternal(packageSources);
    }

    public async setAuthForSourcesInTempNuGetConfigAsync(): Promise<void>
    {
        tl.debug('Setting auth in the temp nuget.config');
        this.ensureTempConfigCreated();

        let sources = await this.getSourcesFromTempNuGetConfig();
        if (sources.length < 1)
        {
            tl.debug('Not setting up auth for temp nuget.config as there are no sources');
            return;
        }

        sources.forEach((source) => {
            if (source.isInternal)
            {
                if(this.authInfo.internalAuthInfo.useCredConfig)
                {
                    tl.debug('Setting auth for internal source ' + source.feedUri);
                    // Removing source first
                    this.removeSourceFromTempNugetConfig(source);               
                    // Re-adding source with creds
                    this.addSourceWithUsernamePasswordToTempNuGetConfig(source, "VssSessionToken", this.authInfo.internalAuthInfo.accessToken);
                }
            }
            // Source is external
            else
            {
                if (!this.authInfo.externalAuthInfo || this.authInfo.externalAuthInfo.length < 1)
                {
                    return;
                }

                let indexAuthInfo: number = this.authInfo.externalAuthInfo.findIndex(externalEndpoint => url.parse(externalEndpoint.packageSource.feedUri).href.toLowerCase() === url.parse(source.feedUri).href.toLowerCase());
                if(indexAuthInfo > -1)
                {
                    let externalEndpointAuthInfo: auth.ExternalAuthInfo = this.authInfo.externalAuthInfo[indexAuthInfo];
                    tl.debug('Setting auth for external source ' + source.feedUri);
                    console.log(tl.loc("Info_MatchingUrlWasFoundSettingAuth") + source.feedUri);
                    switch(externalEndpointAuthInfo.authType)
                    {
                        case (auth.ExternalAuthType.UsernamePassword):
                            let usernamePwdAuthInfo =  externalEndpointAuthInfo as auth.UsernamePasswordExternalAuthInfo;
                            this.removeSourceFromTempNugetConfig(source);               
                            this.addSourceWithUsernamePasswordToTempNuGetConfig(source, usernamePwdAuthInfo.username, usernamePwdAuthInfo.password);
                            break;
                        case (auth.ExternalAuthType.Token):
                            let tokenAuthInfo =  externalEndpointAuthInfo as auth.TokenExternalAuthInfo;
                            this.removeSourceFromTempNugetConfig(source);               
                            this.addSourceWithUsernamePasswordToTempNuGetConfig(source, "CustomToken", tokenAuthInfo.token);
                            break;
                        case (auth.ExternalAuthType.ApiKey):
                            let apiKeyAuthInfo =  externalEndpointAuthInfo as auth.ApiKeyExternalAuthInfo;
                            this.setApiKeyForSourceInTempNuGetConfig(source, apiKeyAuthInfo.apiKey);
                            break;
                        default:
                            break;
                    }
                }
            }
        });
    }

    private getTempNuGetConfigPath(): string {
        const tempNuGetConfigBaseDir = NuGetConfigHelper2.getTempNuGetConfigBasePath();
        const tempNuGetConfigFileName = "tempNuGet_" + tl.getVariable("build.buildId") + ".config";
        return path.join(tempNuGetConfigBaseDir, "Nuget", tempNuGetConfigFileName);
    }

    private getSourcesFromTempNuGetConfig(): Q.Promise<IPackageSource[]> {
        // load content of the user's nuget.config
        let configPath: string = this.tempNugetConfigPath ? this.tempNugetConfigPath : this.nugetConfigPath;

        if (!configPath)
        {
            return Q.resolve([]);
        }

        tl.debug('Getting sources from NuGet.config in this location: ' + configPath);

        let xmlString = fs.readFileSync(configPath).toString();

        // strip BOM; xml parser doesn't like it
        if (xmlString.charCodeAt(0) === 0xFEFF) {
            xmlString = xmlString.substr(1);
        }

        // get package sources
        return Q.nfcall<any>(xmlreader.read, xmlString)
            .then(configXml => {
                let packageSources = [];
                let packageSource: IPackageSource;
                let sourceKey;
                let sourceValue;

                // give clearer errors if the user has set an invalid nuget.config
                if (!configXml.configuration) {
                    if (configXml.packages) {
                        throw new Error(tl.loc(
                            "NGCommon_NuGetConfigIsPackagesConfig",
                            this.nugetConfigPath || this.tempNugetConfigPath,
                            tl.getVariable("Task.DisplayName")));
                    }
                    else {
                        throw new Error(tl.loc("NGCommon_NuGetConfigIsInvalid", this.nugetConfigPath || this.tempNugetConfigPath));
                    }
                }

                if (!configXml.configuration.packageSources || !configXml.configuration.packageSources.add) {
                    tl.warning(tl.loc("NGCommon_NoSourcesFoundInConfig", this.nugetConfigPath || this.tempNugetConfigPath));
                    return [];
                }

                for (let i = 0; i < configXml.configuration.packageSources.add.count(); i++) {
                    sourceKey = configXml.configuration.packageSources.add.at(i).attributes().key;
                    sourceValue = configXml.configuration.packageSources.add.at(i).attributes().value;
                    if (!sourceKey || !sourceValue) {
                        continue;
                    }

                    packageSource = { feedName: sourceKey, feedUri: sourceValue, isInternal: false };
                    let isInternalFeed: boolean = this.shouldGetCredentialsForFeed(packageSource);
                    packageSource.isInternal = isInternalFeed;
                    packageSources.push(packageSource);
                }

                return packageSources;
            });
    }

    private removeSourceFromTempNugetConfig(packageSource: IPackageSource) {
        let nugetTool = ngToolRunner.createNuGetToolRunner(this.nugetPath, this.environmentSettings, this.authInfo);

        nugetTool.arg("sources");
        nugetTool.arg("Remove");
        nugetTool.arg("-NonInteractive");
        nugetTool.arg("-Name");
        nugetTool.arg(packageSource.feedName);
        nugetTool.arg("-ConfigFile");
        nugetTool.arg(this.tempNugetConfigPath);

        // short run, use execSync 
        nugetTool.execSync();
    }

    
    private addSourcesToTempNugetConfigInternal(packageSources: IPackageSource[]) {
        packageSources.forEach((source) => {
            let nugetTool = ngToolRunner.createNuGetToolRunner(this.nugetPath, this.environmentSettings, this.authInfo);

            nugetTool.arg("sources");
            nugetTool.arg("Add");
            nugetTool.arg("-NonInteractive");
            nugetTool.arg("-Name");
            nugetTool.arg(source.feedName);
            nugetTool.arg("-Source");
            nugetTool.arg(source.feedUri);
            nugetTool.arg("-ConfigFile");
            nugetTool.arg(this.tempNugetConfigPath);

            // short run, use execSync
            nugetTool.execSync();
        });
    }

    private addSourceWithUsernamePasswordToTempNuGetConfig(source: IPackageSource, username: string, password: string)
    {
            let nugetTool = ngToolRunner.createNuGetToolRunner(this.nugetPath, this.environmentSettings, this.authInfo);
            nugetTool.arg("sources");
            nugetTool.arg("Add");
            nugetTool.arg("-NonInteractive");
            nugetTool.arg("-Name");
            nugetTool.arg(source.feedName);
            nugetTool.arg("-Source");
            nugetTool.arg(source.feedUri);
            nugetTool.arg("-ConfigFile");
            nugetTool.arg(this.tempNugetConfigPath);
            nugetTool.arg("-Username");
            nugetTool.arg(username);
            nugetTool.arg("-Password");
            nugetTool.arg(password);

            if (tl.osType() !== 'Windows_NT') {
                // only Windows supports DPAPI. Older NuGets fail to add credentials at all if DPAPI fails. 
                nugetTool.arg("-StorePasswordInClearText");
            }

            // short run, use execSync
            nugetTool.execSync();
    }

    private setApiKeyForSourceInTempNuGetConfig(source: IPackageSource, apiKey: string)
    {
            let nugetTool = ngToolRunner.createNuGetToolRunner(this.nugetPath, this.environmentSettings, this.authInfo);
            nugetTool.arg("setapikey");
            nugetTool.arg(apiKey);
            nugetTool.arg("-NonInteractive");
            nugetTool.arg("-Source");
            nugetTool.arg(source.feedUri);
            nugetTool.arg("-ConfigFile");
            nugetTool.arg(this.tempNugetConfigPath);

            // short run, use execSync
            nugetTool.execSync();
    }

    private shouldGetCredentialsForFeed(source: IPackageSource): boolean {
        let uppercaseUri = source.feedUri.toUpperCase();
        return this.authInfo.internalAuthInfo.uriPrefixes.some(prefix => uppercaseUri.indexOf(prefix.toUpperCase()) === 0);
    }
}
