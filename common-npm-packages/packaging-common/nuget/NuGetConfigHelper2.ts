import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as tl from "azure-pipelines-task-lib/task";

import * as auth from "./Authentication";
import { IPackageSource } from "./Authentication";
import { INuGetXmlHelper } from "./INuGetXmlHelper";
import * as ngToolRunner from "./NuGetToolRunner2";
import { NuGetExeXmlHelper } from "./NuGetExeXmlHelper";
import { NuGetXmlHelper } from "./NuGetXmlHelper";
import * as ngutil from "./Utility";

// NuGetConfigHelper2 handles authenticated scenarios where the user selects a source from the UI or from a service connection.
// It is used by the NuGetCommand >= v2.0.0 and DotNetCoreCLI >= v2.0.0

const nugetFileName: string = 'nuget.config';

export class NuGetConfigHelper2 {
    public tempNugetConfigPath = undefined;
    private nugetXmlHelper: INuGetXmlHelper;
    private rootNuGetFiles: Array<string>;

    constructor(
        private nugetPath: string,
        private nugetConfigPath: string,
        private authInfo: auth.NuGetExtendedAuthInfo,
        private environmentSettings: ngToolRunner.NuGetEnvironmentSettings,
        tempConfigPath: string /*optional*/,
        useNuGetToModifyConfigFile?: boolean /* optional */)
    {
        this.tempNugetConfigPath = tempConfigPath || this.getTempNuGetConfigPath();
        useNuGetToModifyConfigFile = useNuGetToModifyConfigFile === undefined ? true : useNuGetToModifyConfigFile;
        this.nugetXmlHelper = useNuGetToModifyConfigFile ?
            new NuGetExeXmlHelper(this.nugetPath, this.tempNugetConfigPath, this.authInfo, this.environmentSettings) :
            new NuGetXmlHelper(this.tempNugetConfigPath);
    }

    public static getTempNuGetConfigBasePath() {
        return tl.getVariable("Agent.BuildDirectory")
        || tl.getVariable("Agent.TempDirectory");
     }

    public ensureTempConfigCreated() {
        // save nuget config file to agent build directory
        tl.debug(tl.loc("Info_SavingTempConfig"));

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

    public setAuthForSourcesInTempNuGetConfig(): void
    {
        tl.debug('Setting auth in the temp nuget.config');
        this.ensureTempConfigCreated();

        let sources = this.getSourcesFromTempNuGetConfig();
        if (sources.length < 1)
        {
            tl.debug('Not setting up auth for temp nuget.config as there are no sources');
            return;
        }

        sources.forEach((source) => {
            tl.debug(`considering source ${source.feedUri}. Internal: ${source.isInternal}`)
            if (source.isInternal)
            {
                if(this.authInfo.internalAuthInfo.useCredConfig)
                {
                    tl.debug('Setting auth for internal source ' + source.feedUri);
                    // Removing source first
                    this.removeSourceFromTempNugetConfig(source);

                    // Cannot add tag that starts with number as a child node of PackageSourceCredentials because of
                    // Bug in nuget 4.9.1 and dotnet 2.1.500
                    // https://github.com/NuGet/Home/issues/7517
                    // https://github.com/NuGet/Home/issues/7524
                    // so working around this by prefixing source with string
                    tl.debug('Prefixing internal source feed name ' + source.feedName + ' with feed-');
                    source.feedName = 'feed-' + source.feedName;

                    // Re-adding source with creds
                    this.addSourceWithUsernamePasswordToTempNuGetConfig(source, "VssSessionToken", this.authInfo.internalAuthInfo.accessToken);
                }
            }
            // Source is external
            else
            {
                if (!this.authInfo.externalAuthInfo || this.authInfo.externalAuthInfo.length < 1)
                {
                    tl.debug('No external auth information');
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
                } else {
                    tl.debug(`No auth information found for source ${source.feedUri}`);
                }
            }
        });
    }

    private getTempNuGetConfigPath(): string {
        const tempNuGetConfigBaseDir = NuGetConfigHelper2.getTempNuGetConfigBasePath();
        const tempNuGetConfigFileName = "tempNuGet_" + tl.getVariable("build.buildId") + ".config";
        return path.join(tempNuGetConfigBaseDir, "Nuget", tempNuGetConfigFileName);
    }

    public getSourcesFromTempNuGetConfig(): IPackageSource[] {
        // load content of the user's nuget.config
        let configPath: string = this.tempNugetConfigPath ? this.tempNugetConfigPath : this.nugetConfigPath;
        if (!configPath)
        {
            return [];
        }

        let packageSources = ngutil.getSourcesFromNuGetConfig(configPath);
        return packageSources.map((source) => this.convertToIPackageSource(source));
    }

    // TODO: Remove these two methods once NuGet issue https://github.com/NuGet/Home/issues/7855 is fixed.
    public backupExistingRootNuGetFiles(): void {
        this.rootNuGetFiles = fs.readdirSync('.').filter((file) => file.toLowerCase() === nugetFileName);
        if (this.shouldWriteRootNuGetFiles()) {
            this.rootNuGetFiles.forEach((file) => fs.renameSync(file, this.temporaryRootNuGetName(file)));
            fs.writeFileSync(nugetFileName, fs.readFileSync(this.tempNugetConfigPath));
        }
    }
    public restoreBackupRootNuGetFiles(): void {
        if (this.shouldWriteRootNuGetFiles()) {
            fs.unlinkSync(nugetFileName);
            this.rootNuGetFiles.forEach((file) => fs.renameSync(this.temporaryRootNuGetName(file), file));
        }
    }

    private removeSourceFromTempNugetConfig(packageSource: IPackageSource) {
        this.nugetXmlHelper.RemoveSourceFromNuGetConfig(packageSource.feedName);
    }

    private addSourcesToTempNugetConfigInternal(packageSources: IPackageSource[]) {
        packageSources.forEach((source) => {
            this.nugetXmlHelper.AddSourceToNuGetConfig(source.feedName, source.feedUri);
        });
    }

    private addSourceWithUsernamePasswordToTempNuGetConfig(source: IPackageSource, username: string, password: string)
    {
        this.nugetXmlHelper.AddSourceToNuGetConfig(source.feedName, source.feedUri, username, password);
    }

    private setApiKeyForSourceInTempNuGetConfig(source: IPackageSource, apiKey: string)
    {
        this.nugetXmlHelper.SetApiKeyInNuGetConfig(source.feedName, apiKey);
    }

    private convertToIPackageSource(source: auth.IPackageSourceBase): IPackageSource {
        const uppercaseUri = source.feedUri.toUpperCase();
        const isInternal = this.authInfo.internalAuthInfo ? this.authInfo.internalAuthInfo.uriPrefixes.some(prefix => uppercaseUri.indexOf(prefix.toUpperCase()) === 0) : false;

        return {
            feedName: source.feedName,
            feedUri: source.feedUri,
            isInternal
        };
    }

    // TODO: Remove these two methods once NuGet issue https://github.com/NuGet/Home/issues/7855 is fixed.
    private temporaryRootNuGetName(nugetFile: string): string {
        return `tempRename_${tl.getVariable('build.buildId')}_${nugetFile}`;
    }
    private shouldWriteRootNuGetFiles(): boolean {
        return (this.nugetConfigPath != null && path.relative('.', this.nugetConfigPath).toLocaleLowerCase() == nugetFileName) || this.rootNuGetFiles.length == 0;
    }
}
