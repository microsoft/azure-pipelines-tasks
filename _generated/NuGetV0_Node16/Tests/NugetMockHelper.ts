import tmrm = require('azure-pipelines-task-lib/mock-run');
import VersionInfoVersion from 'azure-pipelines-tasks-packaging-common-v3/pe-parser/VersionInfoVersion'
import {VersionInfo} from 'azure-pipelines-tasks-packaging-common-v3/pe-parser/VersionResource'

import * as pkgMock from 'azure-pipelines-tasks-packaging-common-v3/Tests/MockHelper';

export class NugetMockHelper {
    private defaultNugetVersion = '3.5.0';
    private defaultNugetVersionInfo = [3,5,0,1500];
    
    constructor(private tmr: tmrm.TaskMockRunner) { 
        process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['BUILD_SOURCESDIRECTORY'] = "c:\\agent\\home\\directory\\sources",
        process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";

        pkgMock.registerLocationHelpersMock(tmr);
    }
    
    public registerDefaultNugetVersionMock() {
        this.registerNugetVersionMock(this.defaultNugetVersion, this.defaultNugetVersionInfo);
    }

    public registerNugetToolGetterMock() {
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common-v3/nuget/NuGetToolGetter', {
            getNuGet: function(versionSpec) {
                return "c:\\from\\tool\\installer\\nuget.exe";
            },
        });
    }
    
    public registerNugetVersionMock(productVersion: string, versionInfoVersion: number[]) {
        this.registerNugetVersionMockInternal(productVersion, versionInfoVersion);
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common-v3/pe-parser/index', {
            getFileVersionInfoAsync: function(nuGetExePath) {
                let result: VersionInfo = { strings: {} };
                result.fileVersion = new VersionInfoVersion(versionInfoVersion[0], versionInfoVersion[1], versionInfoVersion[2], versionInfoVersion[3]);
                result.productVersion = new VersionInfoVersion(versionInfoVersion[0], versionInfoVersion[1], versionInfoVersion[2], versionInfoVersion[3]);
                result.strings['ProductVersion'] = productVersion;
                return result;
            }
        })
    }

    private registerNugetVersionMockInternal(productVersion: string, versionInfoVersion: number[]) {
        this.tmr.registerMock('../pe-parser', {
            getFileVersionInfoAsync: function(nuGetExePath) {
                let result: VersionInfo = { strings: {} };
                result.fileVersion = new VersionInfoVersion(versionInfoVersion[0], versionInfoVersion[1], versionInfoVersion[2], versionInfoVersion[3]);
                result.strings['ProductVersion'] = productVersion;
                return result;
            }
        })
    }
    
    public registerNugetUtilityMock(projectFile: string[]) {
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common-v3/nuget/Utility', {
            resolveFilterSpec: function(filterSpec, basePath?, allowEmptyMatch?) {
                return projectFile;
            },
            stripLeadingAndTrailingQuotes: function(path) {
                return path;
            },
            locateCredentialProvider: function(path) {
                return 'c:\\agent\\home\\directory\\externals\\nuget\\CredentialProvider';
            },
            setConsoleCodePage: function() {
                var tlm = require('azure-pipelines-task-lib/mock-task');
                tlm.debug(`setting console code page`);
            }
        } );
        
        this.tmr.registerMock('./Utility', {
            resolveToolPath: function(path) {
                return path;
            }
        });
    }
    
    public registerToolRunnerMock() {
        var mtt = require('azure-pipelines-task-lib/mock-toolrunner');
        this.tmr.registerMock('azure-pipelines-task-lib/toolrunner', mtt);
    }
    
    public setAnswers(a) {
        a.osType["osType"] = "Windows_NT";
        a.exist["c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe"] = true;
        a.exist["c:\\agent\\home\\directory\\externals\\nuget\\CredentialProvider\\CredentialProvider.TeamBuild.exe"] = true;
        this.tmr.setAnswers(a);
    }
}