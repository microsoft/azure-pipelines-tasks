import tmrm = require('azure-pipelines-task-lib/mock-run');
import VersionInfoVersion from 'azure-pipelines-tasks-packaging-common/pe-parser/VersionInfoVersion'
import {VersionInfo} from 'azure-pipelines-tasks-packaging-common/pe-parser/VersionResource'

import * as pkgMock from 'azure-pipelines-tasks-packaging-common/Tests/MockHelper';
import nMockHelper = require('azure-pipelines-tasks-packaging-common/Tests/NuGetMockHelper');

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
        nMockHelper.registerNugetToolGetterMock(tmr);
    }
    
    public setNugetVersionInputDefault() {
        this.tmr.setInput('nuGetVersion', this.defaultNugetVersion);
    }
    
    public registerDefaultNugetVersionMock() {
        this.registerNugetVersionMock(this.defaultNugetVersion, this.defaultNugetVersionInfo);
    }
    
    public registerNugetVersionMock(productVersion: string, versionInfoVersion: number[]) {
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
        nMockHelper.registerNugetUtilityMock(this.tmr, projectFile);
    }
    
    public registerNugetConfigMock() {
        var nchm = require('./NuGetConfigHelper-mock');
        this.tmr.registerMock('packaging-common/nuget/NuGetConfigHelper', nchm);
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