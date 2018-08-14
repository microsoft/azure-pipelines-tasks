import tmrm = require('vsts-task-lib/mock-run');
import VersionInfoVersion from 'nuget-task-common/pe-parser/VersionInfoVersion'
import {VersionInfo, VersionStrings} from 'nuget-task-common/pe-parser/VersionResource'
import * as auth from 'nuget-task-common/Authentication'

export class DotnetMockHelper {
    private defaultNugetVersion = '4.0.0';
    private defaultNugetVersionInfo = [4,0,0,0];

    constructor(private tmr: tmrm.TaskMockRunner) {
        process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['AGENT.TEMPDIRECTORY'] = "c:\\agent\\home\\temp";
        process.env['BUILD_SOURCESDIRECTORY'] = "c:\\agent\\home\\directory\\sources",
        process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";
        process.env['BUILD_BUILDID'] = "1";

        this.registerNugetLocationHelpersMock();
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

    public setOnPremServerUris() {
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.privatedomain.com/defaultcollection";
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.privatedomain.com/defaultcollection";
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
                return [`fromMockedUtility-${input}`];
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
            getNuGetFeedRegistryUrl(accessToken, feedId, nuGetVersion) {
                return 'https://vsts/packagesource';
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

        public registerNuGetPackUtilsMock() {
        this.tmr.registerMock( "nuget-task-common/PackUtilities", {
            getUtcDateString: function() {
                return 'YYYYMMDD-HHMMSS';
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

    public registerNugetLocationHelpersMock() {
        this.tmr.registerMock('nuget-task-common/LocationHelpers', {
            NUGET_ORG_V3_URL: 'https://api.nuget.org/v3/index.json'
        });
        this.tmr.registerMock('utility-common/packaging/locationUtilities', {
            getPackagingUris: function(input) {
                const collectionUrl: string = "https://vsts/packagesource";
                return {
                    PackagingUris: [collectionUrl],
                    DefaultPackagingUri: collectionUrl
                };
            },
            ProtocolType: {NuGet: 1, Npm: 2, Maven: 3}
        });
    }

    private registerMockWithMultiplePaths(paths: string[], mock: any) {
        for(let i = 0; i < paths.length; i++) {
            this.tmr.registerMock(paths[i], mock);
        }
    }
}
