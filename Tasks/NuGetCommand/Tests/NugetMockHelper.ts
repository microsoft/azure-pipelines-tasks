import tmrm = require('vsts-task-lib/mock-run');
import VersionInfoVersion from 'nuget-task-common/pe-parser/VersionInfoVersion'
import {VersionInfo, VersionStrings} from 'nuget-task-common/pe-parser/VersionResource'
import * as auth from 'nuget-task-common/Authentication'
import * as nugetPackUtils from "nuget-task-common/PackUtilities"

export class NugetMockHelper {
    private defaultNugetVersion = '4.0.0';
    private defaultNugetVersionInfo = [4,0,0,0];

    constructor(
        private tmr: tmrm.TaskMockRunner) {
        process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['BUILD_SOURCESDIRECTORY'] = "c:\\agent\\home\\directory\\sources",
        process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";
    }

    public setNugetVersionInputDefault() {
    }

    public registerDefaultNugetVersionMock() {
        this.registerNugetVersionMock(this.defaultNugetVersion, this.defaultNugetVersionInfo);
        this.registerNugetToolGetterMock();
    }

    public registerNugetToolGetterMock() {
        this.tmr.registerMock('nuget-task-common/NuGetToolGetter', {
            getNuGet: function(versionSpec) {
                return "c:\\from\\tool\\installer\\nuget.exe";
            },
            cacheBundledNuGet: function(){},
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
        this.registerMockWithMultiplePaths(['nuget-task-common/pe-parser', './pe-parser'], {
            getFileVersionInfoAsync: function(nuGetExePath) {
                let result: VersionInfo = { strings: {} };
                result.fileVersion = new VersionInfoVersion(versionInfoVersion[0], versionInfoVersion[1], versionInfoVersion[2], versionInfoVersion[3]);
                result.strings['ProductVersion'] = productVersion;
                return result;
            }
        })
    }

    private registerNugetVersionMockInternal(productVersion: string, versionInfoVersion: number[]) {
        this.registerMockWithMultiplePaths(['nuget-task-common/pe-parser/index', './pe-parser/index'], {
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
        this.tmr.registerMock('nuget-task-common/Utility', {
            getPatternsArrayFromInput: function(input) {
                return [input];
            },
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
            },
            getNuGetFeedRegistryUrl(accessToken, feedId, nuGetVersion) {
                return 'https://vsts/packagesource';
            }
        });
    }

        public registerNugetUtilityMockUnix() {
        this.tmr.registerMock('nuget-task-common/Utility', {
            getPatternsArrayFromInput: function(input) {
                return [input];
            },
            resolveFilterSpec: function(filterSpec, basePath?, allowEmptyMatch?) {
                return ["~/myagent/_work/1/s/single.sln"];
            },
            getBundledNuGetLocation: function(version) {
                return '~/myagent/_work/_tasks/NuGet/nuget.exe';
            },
            locateCredentialProvider: function(path) {
                return '~/myagent/_work/_tasks/NuGet/CredentialProvider';
            },
            setConsoleCodePage: function() {
                var tlm = require('vsts-task-lib/mock-task');
                tlm.debug(`setting console code page`);
            }
        });
    }

    public registerVstsNuGetPushRunnerMock() {
        this.tmr.registerMock('./Common/VstsNuGetPushToolUtilities', {
            getBundledVstsNuGetPushLocation: function() {
                return 'c:\\agent\\home\\directory\\externals\\nuget\\VstsNuGetPush.exe';
            }
        });
    }

    public registerNuGetPackUtilsMock(date: Date) {
        this.tmr.registerMock("nuget-task-common/PackUtilities", {
            getNowDateString: function(timezone: string) {
                return nugetPackUtils.getUtcDateString(date);
            }
        });
    }

    public registerNugetConfigMock() {
        var nchm = require('./NuGetConfigHelper-mock');
        this.tmr.registerMock('nuget-task-common/NuGetConfigHelper2', nchm);
    }

    public registerToolRunnerMock() {
        var mtt = require('vsts-task-lib/mock-toolrunner');
        this.tmr.registerMock('vsts-task-lib/toolrunner', mtt);
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
                                getVersioningData: async function (ApiVersion, PackagingAreaName, PackageAreaId, Obj) {
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

    private registerMockWithMultiplePaths(paths: string[], mock: any) {
        for(let i = 0; i < paths.length; i++) {
            this.tmr.registerMock(paths[i], mock);
        }
    }
}