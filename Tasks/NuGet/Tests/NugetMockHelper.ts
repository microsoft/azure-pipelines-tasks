import tmrm = require('vsts-task-lib/mock-run');
import VersionInfoVersion from 'nuget-task-common/pe-parser/VersionInfoVersion'
import {VersionInfo, VersionStrings} from 'nuget-task-common/pe-parser/VersionResource'

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
    }
    
    public registerDefaultNugetVersionMock() {
        this.registerNugetVersionMock(this.defaultNugetVersion, this.defaultNugetVersionInfo);
    }

    public registerNugetToolGetterMock() {
        this.tmr.registerMock('nuget-task-common/NuGetToolGetter', {
            getNuGet: function(versionSpec) {
                return "c:\\from\\tool\\installer\\nuget.exe";
            },
        });
    }
    
    public registerNugetVersionMock(productVersion: string, versionInfoVersion: number[]) {
        this.registerNugetVersionMockInternal(productVersion, versionInfoVersion);
        this.tmr.registerMock('nuget-task-common/pe-parser/index', {
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
        this.tmr.registerMock('./pe-parser', {
            getFileVersionInfoAsync: function(nuGetExePath) {
                let result: VersionInfo = { strings: {} };
                result.fileVersion = new VersionInfoVersion(versionInfoVersion[0], versionInfoVersion[1], versionInfoVersion[2], versionInfoVersion[3]);
                result.strings['ProductVersion'] = productVersion;
                return result;
            }
        })
    }
    
    public registerNugetUtilityMock(projectFile: string[]) {
        this.tmr.registerMock('nuget-task-common/Utility', {
            resolveFilterSpec: function(filterSpec, basePath?, allowEmptyMatch?) {
                return projectFile;
            },
            getBundledNuGetLocation: function(version) {
                return 'c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe';
            },
            stripLeadingAndTrailingQuotes: function(path) {
                return path;
            },
            locateCredentialProvider: function(path) {
                return 'c:\\agent\\home\\directory\\externals\\nuget\\CredentialProvider';
            },
            setConsoleCodePage: function() {
                var tlm = require('vsts-task-lib/mock-task');
                tlm.debug(`setting console code page`);
            }
        } )
    }
    
    public registerNugetConfigMock() {
        var nchm = require('./NuGetConfigHelper-mock');
        this.tmr.registerMock('nuget-task-common/NuGetConfigHelper', nchm);
    }
    
    public registerToolRunnerMock() {
        var mtt = require('vsts-task-lib/mock-toolrunner');
        this.tmr.registerMock('vsts-task-lib/toolrunner', mtt);
    }
    
    public setAnswers(a) {
        a.osType["osType"] = "Windows_NT";
        a.exist["c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe"] = true;
        a.exist["c:\\agent\\home\\directory\\externals\\nuget\\CredentialProvider\\CredentialProvider.TeamBuild.exe"] = true;
        this.tmr.setAnswers(a);
    }
}