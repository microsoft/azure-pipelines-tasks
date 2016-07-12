import fs = require('fs');
import https = require('https');
import path = require('path');
import Q = require('q');
import tl = require('vsts-task-lib/task');
import url = require('url');

import * as auth from "./Authentication"
import * as ngToolRunner from "./NuGetToolRunner"
import * as util from 'util';

var xmlreader = require('xmlreader');

interface IPackageSource {
    id: number;
    feedName: string;
    feedUri: string;
    addCredential: boolean
}

export class NuGetConfigHelper {

    private _nugetPath: string;
    private _nugetConfigPath: string;
    private _authInfo: auth.NuGetAuthInfo;
    private _environmentSettings: ngToolRunner.NuGetEnvironmentSettings;

    private tempNugetConfigDir = path.join(tl.getVariable('agent.buildDirectory'), 'Nuget');
    private tempNugetConfigFileName = 'tempNuGet_' + tl.getVariable('build.buildId') + '.config';
    public tempNugetConfigPath = path.join(this.tempNugetConfigDir, this.tempNugetConfigFileName);

    constructor(nugetPath: string, nugetConfigPath: string, authInfo: auth.NuGetAuthInfo, environmentSettings: ngToolRunner.NuGetEnvironmentSettings) {
        this._nugetPath = nugetPath;
        this._nugetConfigPath = nugetConfigPath;
        this._authInfo = authInfo;
        this._environmentSettings = environmentSettings;
    }

    public setCredentialsNuGetConfigAndSaveTemp(): Q.Promise<string> {

        // load content of the user's nuget.config
        var xmlString = fs.readFileSync(this._nugetConfigPath).toString();

        // strip BOM; xml parser doesn't like it
        if (xmlString.charCodeAt(0) === 0xFEFF) {
            xmlString = xmlString.substr(1);
        }

        // get package sources
        return Q.nfcall<any>(xmlreader.read, xmlString)
            .then(configXml => {
                var packageSources = [];
                var packageSource: IPackageSource;
                var sourceKey;
                var sourceValue;

                for (var i = 0; i < configXml.configuration.packageSources.add.count(); i++) {
                    sourceKey = configXml.configuration.packageSources.add.at(i).attributes().key;
                    sourceValue = configXml.configuration.packageSources.add.at(i).attributes().value;
                    packageSource = { id: i, feedName: sourceKey, feedUri: sourceValue, addCredential: false };

                    // check if need to add credential to feed
                    tl._writeLine('check credential: ' + sourceValue)
                    if (this.shouldGetCredentialsForFeed(packageSource)) {
                        packageSources.push(packageSource);
                    }
                }

                if (packageSources.length === 0) {
                    // nothing to do; calling code should use the user's config unmodified.
                    this._nugetConfigPath;
                }

                // save nuget config file to agent build directory
                tl._writeLine('save nuget.config to temp config file');
                if (!(fs.existsSync(this.tempNugetConfigDir))) {
                    fs.mkdirSync(this.tempNugetConfigDir);
                };
                // small file, use writeFileSync
                fs.writeFileSync(this.tempNugetConfigPath, xmlString);

                // remove sources
                tl._writeLine('remove sources in the config file');
                this.removeSourcesInNugetConfig(packageSources);

                // add sources
                tl._writeLine('add sources in the config file');
                this.addSourcesInNugetConfig(packageSources);

                return this.tempNugetConfigPath;
            });
    }

    private removeSourcesInNugetConfig(packageSources: IPackageSource[]) {
        packageSources.forEach((source) => {
            var nugetTool = ngToolRunner.createNuGetToolRunner(this._nugetPath, this._environmentSettings);

            nugetTool.arg('sources');
            nugetTool.arg('Remove');
            nugetTool.arg('-NonInteractive');
            nugetTool.arg('-Name');
            nugetTool.arg(source.feedName);
            nugetTool.arg('-ConfigFile')
            nugetTool.pathArg(this.tempNugetConfigPath);

            // short run, use execSync 
            nugetTool.execSync();
        });
    }

    private addSourcesInNugetConfig(packageSources: IPackageSource[]) {
        packageSources.forEach((source) => {
            var nugetTool = ngToolRunner.createNuGetToolRunner(this._nugetPath, this._environmentSettings);

            nugetTool.arg('sources');
            nugetTool.arg('Add');
            nugetTool.arg('-NonInteractive');
            nugetTool.arg('-Name');
            nugetTool.arg(source.feedName);
            nugetTool.arg('-Source');
            nugetTool.arg(source.feedUri);
            nugetTool.arg('-Username');
            nugetTool.arg('VssSessionToken');
            nugetTool.arg('-Password');
            nugetTool.arg(this._authInfo.accessToken);
            nugetTool.arg('-ConfigFile')
            nugetTool.pathArg(this.tempNugetConfigPath);

            // short run, use execSync
            nugetTool.execSync();
        });
    }

    private shouldGetCredentialsForFeed(source: IPackageSource): boolean {
        var uppercaseUri = source.feedUri.toUpperCase();
        return this._authInfo.uriPrefixes.some(prefix => uppercaseUri.indexOf(prefix.toUpperCase()) === 0);
    }
}


