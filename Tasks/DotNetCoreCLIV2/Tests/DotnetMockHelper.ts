import tmrm = require('azure-pipelines-task-lib/mock-run');
import VersionInfoVersion from 'packaging-common/pe-parser/VersionInfoVersion'
import {VersionInfo} from 'packaging-common/pe-parser/VersionResource'

import * as pkgMock from 'packaging-common/Tests/MockHelper';

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

        pkgMock.registerLocationHelpersMock(tmr);
    }

    public setNugetVersionInputDefault() {
    }

    public registerDefaultNugetVersionMock() {
        this.registerNugetVersionMock(this.defaultNugetVersion, this.defaultNugetVersionInfo);
        this.registerNugetToolGetterMock();
    }

    public registerNugetToolGetterMock() {
        this.tmr.registerMock('packaging-common/nuget/NuGetToolGetter', {
            getNuGet: function(versionSpec) {
                return "c:\\from\\tool\\installer\\nuget.exe";
            },
        } )
    }

    public registerNugetVersionMock(productVersion: string, versionInfoVersion: number[]) {
        this.registerNugetVersionMockInternal(productVersion, versionInfoVersion);
        this.registerMockWithMultiplePaths(['packaging-common/pe-parser', './pe-parser'], {
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
        this.registerMockWithMultiplePaths(['packaging-common/pe-parser/index', './pe-parser/index'], {
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
        this.tmr.registerMock('packaging-common/nuget/Utility', {
            getPatternsArrayFromInput: function(input) {
                return [`fromMockedUtility-${input}`];
            },
            resolveFilterSpec: function(filterSpec, basePath?, allowEmptyMatch?) {
                return projectFile;
            },
            stripLeadingAndTrailingQuotes: function(path) {
                return path;
            },
            getNuGetFeedRegistryUrl(
                packagingCollectionUrl: string,
                feedId: string,
                nuGetVersion: VersionInfo,
                accessToken?: string,
                useSession?: boolean) {
                if (useSession) {
                    console.log("Using session registry url");
                }
                else {
                    console.log("Using feed registry url");
                }
                return 'https://vsts/packagesource';
            }
        });
        
        this.tmr.registerMock('./Utility', {
            resolveToolPath: function(path) {
                return path;
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
        this.tmr.registerMock( "packaging-common/PackUtilities", {
            getUtcDateString: function() {
                return 'YYYYMMDD-HHMMSS';
            }
        });
    }

    public registerNugetConfigMock() {
        var nchm = require('./NuGetConfigHelper-mock');
        this.tmr.registerMock('packaging-common/nuget/NuGetConfigHelper2', nchm);
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

    private registerMockWithMultiplePaths(paths: string[], mock: any) {
        for(let i = 0; i < paths.length; i++) {
            this.tmr.registerMock(paths[i], mock);
        }
    }
}
