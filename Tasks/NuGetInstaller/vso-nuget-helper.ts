/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import fs = require('fs');
import https = require('https');
import path = require('path');
import Q = require('q');
import tl = require('vsts-task-lib/task');
import url = require('url');

var xmlreader = require('xmlreader');

interface IPackageSource {
    id: number;
    feedName: string;
    feedUri: string;
    addCredential: boolean
}

export class VsoNuGetHelper {

    private _nugetPath: string;
    private _nugetConfigPath: string;
    private _accessToken: string;

    private tempNugetConfigDir = path.join(tl.getVariable('agent.buildDirectory'), 'Nuget');
    private tempNugetConfigFileName = 'tempNuGet_' + tl.getVariable('build.buildId') + '.config';
    public tempNugetConfigPath = path.join(this.tempNugetConfigDir, this.tempNugetConfigFileName);
  
    constructor(nugetPath: string, nugetConfigPath: string, accessToken: string) {
        this._nugetPath = nugetPath;
        this._nugetConfigPath = nugetConfigPath;
        this._accessToken = accessToken;
    }

    public setCredentialsNuGetConfigAndSaveTemp(): Q.Promise<boolean> {
        var def = Q.defer<boolean>();

        // load content of the user's nuget.config
        var xml = fs.readFileSync(this._nugetConfigPath).toString();

        // get package sources
        xmlreader.read(xml, (err, res) => {
            if (err) return tl.error('configure file error: ' + err);

            var packageSources = [];
            var packageSource: IPackageSource;
            var sourceKey;
            var sourceValue;
            var promises: Q.Promise<{}>[] = [];
            var deffered: Q.Deferred<{}>;
            var deffers: Q.Deferred<{}>[] = [];

            for (var i = 0; i < res.configuration.packageSources.add.count(); i++) {

                sourceKey = res.configuration.packageSources.add.at(i).attributes().key;
                sourceValue = res.configuration.packageSources.add.at(i).attributes().value;
                packageSource = { id: i, feedName: sourceKey, feedUri: sourceValue, addCredential: false };
                deffered = Q.defer();
                deffers[i] = deffered;
                promises.push(deffered.promise);

                // check if need to add credential to feed
                tl._writeLine('check credential: ' + sourceValue)
                this.shouldGetCredentialsForFeed(packageSource).then((result) => {                         
                    if (result.addCredential) {
                        packageSources.push({
                            key: result.feedName, 
                            value: result.feedUri
                        });
                    }

                    deffers[result.id].resolve(result);
                });            
            }

            Q.allSettled(promises).then(() => {
                // save nuget config file to agent build directory
                tl._writeLine('save nuget.config to temp config file');
                if (!(fs.existsSync(this.tempNugetConfigDir))) {
                    fs.mkdirSync(this.tempNugetConfigDir);
                };
                // small file, use writeFileSync
                fs.writeFileSync(this.tempNugetConfigPath, xml);
         
                // remove sources
                tl._writeLine('remove sources in the config file');
                this.removeSourcesInNugetConfig(packageSources);

                // add sources
                tl._writeLine('add sources in the config file');
                this.addSourcesInNugetConfig(packageSources);

                def.resolve(true);
            },
            (err) => {              
                def.reject("failed to add sources");
            });
        });  

        return def.promise;
    }

    private removeSourcesInNugetConfig(packageSources: any[]) {
        packageSources.forEach((source) => {
            var nugetTool = tl.createToolRunner(this._nugetPath);

            nugetTool.arg('sources');
            nugetTool.arg('remove');
            nugetTool.arg('-name');
            nugetTool.arg(source.key);
            nugetTool.arg('-Configfile')
            nugetTool.pathArg(this.tempNugetConfigPath);

            // short run, use execSync 
            nugetTool.execSync(null);
        });
    }

    private addSourcesInNugetConfig(packageSources: any[]) {      
        packageSources.forEach((source) => {            
            var nugetTool = tl.createToolRunner(this._nugetPath);

            nugetTool.arg('sources');
            nugetTool.arg('add');
            nugetTool.arg('-name');
            nugetTool.arg(source.key);
            nugetTool.arg('-source');
            nugetTool.arg(source.value);
            nugetTool.arg('-username');
            nugetTool.arg('VssSessionToken');
            nugetTool.arg('-password');
            nugetTool.arg(this._accessToken);
            nugetTool.arg('-Configfile')
            nugetTool.pathArg(this.tempNugetConfigPath);

            // short run, use execSync
            nugetTool.execSync(null); 
        });
    }

    private shouldGetCredentialsForFeed(source: IPackageSource): Q.Promise<IPackageSource> {
        var deferred = Q.defer<any>();
        var result: IPackageSource = { id: source.id, feedName: source.feedName, feedUri: source.feedUri, addCredential: false };
        var protocol = url.parse(source.feedUri).protocol;

        tl._writeLine('verify protocol: ' + source.feedUri);
        if (!(protocol.toLowerCase() == 'https:')) {   
            return Q(result);
        }

        var tfsHeaderPresent = false;
        var vssHeaderPresent = false;
        https.get(source.feedUri, (res) => {
            tl._writeLine('verify data returned from https response: ' + source.feedUri);
            //bypass tsc error: property doesn't exists on type
            var response: any = res;
            if (response.statusCode == 401) {
                var headers = JSON.parse(JSON.stringify(response.headers));
                for (var key in headers) {
                    if (headers.hasOwnProperty(key)) {
                        if (tfsHeaderPresent || key.toLowerCase().indexOf('x-tfs') != -1) {
                            tfsHeaderPresent = true;
                        };

                        if (vssHeaderPresent || key.toLowerCase().indexOf('x-vss') != -1) {
                            vssHeaderPresent = true;
                        };

                        if (tfsHeaderPresent && vssHeaderPresent) {
                            break;
                        }
                    }
                }
                result.addCredential = tfsHeaderPresent && vssHeaderPresent;
                deferred.resolve(result);
            }
            else {
                deferred.resolve(result);
            };
        }).on('error', (e) => {
            tl.error(e.message);
            deferred.resolve(result);
        });
      
        return deferred.promise;
    }
}


