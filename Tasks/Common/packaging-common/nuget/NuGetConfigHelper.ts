import * as fs from "fs";
import * as path from "path";
import * as Q from "q";
import * as tl from "azure-pipelines-task-lib/task";

import * as auth from "./Authentication";
import * as ngToolRunner from "./NuGetToolRunner";

let xmlreader = require("xmlreader");

export interface IPackageSource {
    feedName: string;
    feedUri: string;
}

export class NuGetConfigHelper {
    private tempNugetConfigBaseDir
        = tl.getVariable("Agent.BuildDirectory")
        || tl.getVariable("Agent.TempDirectory");
    private tempNugetConfigDir = path.join(this.tempNugetConfigBaseDir, "Nuget");
    private tempNugetConfigFileName = "tempNuGet_" + tl.getVariable("build.buildId") + ".config";
    public tempNugetConfigPath = path.join(this.tempNugetConfigDir, this.tempNugetConfigFileName);

    constructor(
        private nugetPath: string,
        private nugetConfigPath: string,
        private authInfo: auth.NuGetAuthInfo,
        private environmentSettings: ngToolRunner.NuGetEnvironmentSettings) {
    }

    public ensureTempConfigCreated() {
        // save nuget config file to agent build directory
        console.log("save nuget.config to temp config file");
        if (!(fs.existsSync(this.tempNugetConfigDir))) {
            fs.mkdirSync(this.tempNugetConfigDir);
        }

        if (this.nugetConfigPath) {
            // don't use cp as that copies the read-only flag, and tfvc sets that on files
            let content = fs.readFileSync(this.nugetConfigPath);
            fs.writeFileSync(this.tempNugetConfigPath, content);
        }
        else {
            // small file, use writeFileSync
            fs.writeFileSync(this.tempNugetConfigPath, "<configuration/>");
        }
    }

    public setSources(packageSources: IPackageSource[], includeAuth: boolean): void {
        this.ensureTempConfigCreated();

        // remove sources
        console.log(tl.loc("NGCommon_RemovingSources"));
        this.removeSourcesInNugetConfig(packageSources);

        // add sources
        console.log(tl.loc("NGCommon_AddingSources"));
        this.addSourcesInNugetConfig(packageSources, includeAuth);
    }

    public getSourcesFromConfig(): Q.Promise<IPackageSource[]> {
        // load content of the user's nuget.config
        let xmlString = fs.readFileSync(this.nugetConfigPath).toString();

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
                            this.nugetConfigPath,
                            tl.getVariable("Task.DisplayName")));
                    }
                    else {
                        throw new Error(tl.loc("NGCommon_NuGetConfigIsInvalid", this.nugetConfigPath));
                    }
                }

                if (!configXml.configuration.packageSources || !configXml.configuration.packageSources.add) {
                    tl.warning(tl.loc("NGCommon_NoSourcesFoundInConfig", this.nugetConfigPath));
                    return [];
                }

                for (let i = 0; i < configXml.configuration.packageSources.add.count(); i++) {
                    sourceKey = configXml.configuration.packageSources.add.at(i).attributes().key;
                    sourceValue = configXml.configuration.packageSources.add.at(i).attributes().value;
                    if (!sourceKey || !sourceValue) {
                        continue;
                    }

                    packageSource = { feedName: sourceKey, feedUri: sourceValue };

                    // check if need to add credential to feed
                    if (this.shouldGetCredentialsForFeed(packageSource)) {
                        packageSources.push(packageSource);
                    }
                }

                return packageSources;
            });
    }

    private removeSourcesInNugetConfig(packageSources: IPackageSource[]) {
        packageSources.forEach((source) => {
            let nugetTool = ngToolRunner.createNuGetToolRunner(this.nugetPath, this.environmentSettings);

            nugetTool.arg("sources");
            nugetTool.arg("Remove");
            nugetTool.arg("-NonInteractive");
            nugetTool.arg("-Name");
            nugetTool.arg(source.feedName);
            nugetTool.arg("-ConfigFile");
            nugetTool.arg(this.tempNugetConfigPath);

            // short run, use execSync 
            nugetTool.execSync();
        });
    }

    private addSourcesInNugetConfig(packageSources: IPackageSource[], includeAuth: boolean) {
        packageSources.forEach((source) => {
            let nugetTool = ngToolRunner.createNuGetToolRunner(this.nugetPath, this.environmentSettings);

            nugetTool.arg("sources");
            nugetTool.arg("Add");
            nugetTool.arg("-NonInteractive");
            nugetTool.arg("-Name");
            nugetTool.arg(source.feedName);
            nugetTool.arg("-Source");
            nugetTool.arg(source.feedUri);
            nugetTool.arg("-ConfigFile");
            nugetTool.arg(this.tempNugetConfigPath);

            if (includeAuth)
            {
                nugetTool.arg("-Username");
                nugetTool.arg("VssSessionToken");
                nugetTool.arg("-Password");
                nugetTool.arg(this.authInfo.accessToken);
            }

            if (tl.osType() !== 'Windows_NT') {
                // only Windows supports DPAPI. Older NuGets fail to add credentials at all if DPAPI fails. 
                nugetTool.arg("-StorePasswordInClearText");
            }

            // short run, use execSync
            nugetTool.execSync();
        });
    }

    private shouldGetCredentialsForFeed(source: IPackageSource): boolean {
        let uppercaseUri = source.feedUri.toUpperCase();
        return this.authInfo.uriPrefixes.some(prefix => uppercaseUri.indexOf(prefix.toUpperCase()) === 0);
    }
}
