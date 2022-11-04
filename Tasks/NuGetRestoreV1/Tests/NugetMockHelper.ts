import tmrm = require('azure-pipelines-task-lib/mock-run');
import VersionInfoVersion from 'azure-pipelines-tasks-packaging-common/pe-parser/VersionInfoVersion'
import {VersionInfo} from 'azure-pipelines-tasks-packaging-common/pe-parser/VersionResource'

import * as pkgMock from 'azure-pipelines-tasks-packaging-common/Tests/MockHelper';

export class NugetMockHelper {
    private defaultNugetVersion = '3.3.0';
    private defaultNugetVersionInfo = [3,3,0,212];
    
    constructor(
        private tmr: tmrm.TaskMockRunner) { 
        process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['BUILD_SOURCESDIRECTORY'] = "c:\\agent\\home\\directory\\sources",
        process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";
        
        pkgMock.registerLocationHelpersMock(tmr);
    }
    
    public setNugetVersionInputDefault() {
        this.tmr.setInput('versionSpec', this.defaultNugetVersion);
    }
    
    public registerDefaultNugetVersionMock() {
        this.registerNugetVersionMock(this.defaultNugetVersion, this.defaultNugetVersionInfo);
        this.registerNugetToolGetterMock();
    }

    public registerNugetToolGetterMock() {
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common/nuget/NuGetToolGetter', {
            getNuGet: function(versionSpec) {
                return "c:\\from\\tool\\installer\\nuget.exe";
            },
            cacheBundledNuGet: function(version, path){
                return version;
            },
            getMSBuildVersionString: function() {
                return "1.0.0.0";
            },
            FORCE_NUGET_4_0_0: 'FORCE_NUGET_4_0_0',
            NUGET_VERSION_4_0_0: '4.0.0',
            NUGET_VERSION_4_0_0_PATH_SUFFIX: 'NuGet/4.0.0/',
            DEFAULT_NUGET_VERSION: '4.1.0',
            DEFAULT_NUGET_PATH_SUFFIX: 'NuGet/4.1.0/',
            NUGET_EXE_TOOL_PATH_ENV_VAR: "NuGetExeToolPath"
        } )
    }
    
    public registerNugetVersionMock(productVersion: string, versionInfoVersion: number[]) {
        this.registerNugetVersionMockInternal(productVersion, versionInfoVersion);
        this.tmr.registerMock('../pe-parser', {
            getFileVersionInfoAsync: function(nuGetExePath) {
                let result: VersionInfo = { strings: {} };
                result.fileVersion = new VersionInfoVersion(versionInfoVersion[0], versionInfoVersion[1], versionInfoVersion[2], versionInfoVersion[3]);
                result.strings['ProductVersion'] = productVersion;
                return result;
            }
        })
    }

    private registerNugetVersionMockInternal(productVersion: string, versionInfoVersion: number[]) {
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common/pe-parser/index', {
            getFileVersionInfoAsync: function(nuGetExePath) {
                let result: VersionInfo = { strings: {} };
                result.fileVersion = new VersionInfoVersion(versionInfoVersion[0], versionInfoVersion[1], versionInfoVersion[2], versionInfoVersion[3]);
                result.productVersion = new VersionInfoVersion(versionInfoVersion[0], versionInfoVersion[1], versionInfoVersion[2], versionInfoVersion[3]);
                result.strings['ProductVersion'] = productVersion;
                return result;
            }
        })
    }
    
    public registerNugetUtilityMock(projectFile: string[]) {
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common/nuget/Utility', {
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
            },
            getNuGetFeedRegistryUrl: function(
                packagingCollectionUrl: string,
                feedId: string,
                nuGetVersion: VersionInfo,
                accessToken?: string) {
                    return packagingCollectionUrl + feedId;
            }
        } );
        
        this.tmr.registerMock('./Utility', {
            resolveToolPath: function(path) {
                return path;
            }
        });
    }
    
    public registerNugetConfigMock() {
        var nchm = require('./NuGetConfigHelper-mock');
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common/nuget/NuGetConfigHelper', nchm);
    }
    
    public registerToolRunnerMock() {
        var mtt = require('azure-pipelines-task-lib/mock-toolrunner');
        this.tmr.registerMock('azure-pipelines-task-lib/toolrunner', mtt);
    }

    public RegisterLocationServiceMocks() {
        this.tmr.registerMock('vso-node-api/WebApi', {
            getBearerHandler: function(token){
                return {};
            }, 
            WebApi: function(url, handler){
                return {
                    getCoreApi: function() {
                        return { 
                            vsoClient: {
                                getVersioningData: function (ApiVersion, PackagingAreaName, PackageAreaId, Obj) { 
                                    return { requestUrl:"foobar" }
                                }
                            }
                        };
                    }
                };
            }
        })
    }
    
    public setAnswers(a) {
        a.osType["osType"] = "Windows_NT";
        a.exist["c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe"] = true;
        a.exist["c:\\from\\tool\\installer\\nuget.exe"] = true;
        a.exist["c:\\agent\\home\\directory\\externals\\nuget\\CredentialProvider\\CredentialProvider.TeamBuild.exe"] = true;
        this.tmr.setAnswers(a);
    }
}