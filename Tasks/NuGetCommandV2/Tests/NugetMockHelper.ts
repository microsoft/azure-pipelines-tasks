import tmrm = require('azure-pipelines-task-lib/mock-run');
import VersionInfoVersion from "azure-pipelines-tasks-packaging-common/pe-parser/VersionInfoVersion"
import {VersionInfo} from 'azure-pipelines-tasks-packaging-common/pe-parser/VersionResource'
import * as nugetPackUtils from "azure-pipelines-tasks-packaging-common/PackUtilities"

import * as pkgMock from 'azure-pipelines-tasks-packaging-common/Tests/MockHelper';
import nMockHelper = require('azure-pipelines-tasks-packaging-common/Tests/NuGetMockHelper');

export class NugetMockHelper {
    private defaultNugetVersion = '4.0.0';
    private defaultNugetVersionInfo = [4,0,0,0];

    constructor(private tmr: tmrm.TaskMockRunner) {
        process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['BUILD_SOURCESDIRECTORY'] = "c:\\agent\\home\\directory\\sources";
        process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";
        process.env['DISABLE_NUGET_PLUGINS_CACHE_WORKAROUND'] = "true";

        pkgMock.registerLocationHelpersMock(tmr);
    }

    public setNugetVersionInputDefault() {
    }

    public registerDefaultNugetVersionMock() {
        this.registerNugetVersionMock(this.defaultNugetVersion, this.defaultNugetVersionInfo);
        nMockHelper.registerNugetToolGetterMock(this.tmr);
    }

    public registerNugetVersionMock(productVersion: string, versionInfoVersion: number[]) {
        this.registerNugetVersionMockInternal(productVersion, versionInfoVersion);
        this.registerMockWithMultiplePaths(['azure-pipelines-tasks-packaging-common/pe-parser', '../pe-parser'], {
            getFileVersionInfoAsync: function(nuGetExePath) {
                let result: VersionInfo = { strings: {} };
                result.fileVersion = new VersionInfoVersion(versionInfoVersion[0], versionInfoVersion[1], versionInfoVersion[2], versionInfoVersion[3]);
                result.strings['ProductVersion'] = productVersion;
                return result;
            }
        })
    }

    private registerNugetVersionMockInternal(productVersion: string, versionInfoVersion: number[]) {
        this.registerMockWithMultiplePaths(['azure-pipelines-tasks-packaging-common/pe-parser/index', '../pe-parser/index'], {
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
        nMockHelper.registerNugetUtilityMock(this.tmr, projectFile);
    }

    public registerNugetUtilityMockUnix(projectFile: string[]) {
        nMockHelper.registerNugetUtilityMockUnix(this.tmr, projectFile);
    }

    public registerVstsNuGetPushRunnerMock() {
        this.tmr.registerMock('./Common/VstsNuGetPushToolUtilities', {
            getBundledVstsNuGetPushLocation: function() {
                return 'c:\\agent\\home\\directory\\externals\\nuget\\VstsNuGetPush.exe';
            }
        });
    }

    public registerNuGetPackUtilsMock(date: Date) {
        this.tmr.registerMock("azure-pipelines-tasks-packaging-common/PackUtilities", {
            getNowDateString: function(timezone: string) {
                return nugetPackUtils.getUtcDateString(date);
            }
        });
    }

    public registerNugetConfigMock() {
        var nchm = require('./NuGetConfigHelper-mock');
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common/nuget/NuGetConfigHelper2', nchm);
    }

    public registerToolRunnerMock() {
        var mtt = require('azure-pipelines-task-lib/mock-toolrunner');
        this.tmr.registerMock('azure-pipelines-task-lib/toolrunner', mtt);
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