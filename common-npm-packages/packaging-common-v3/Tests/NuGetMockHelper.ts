import tmrm = require('azure-pipelines-task-lib/mock-run');

import {VersionInfo} from '../pe-parser/VersionResource'
	
export function registerNugetToolGetterMock(tmr: tmrm.TaskMockRunner) {
    tmr.registerMock('azure-pipelines-tasks-packaging-common-v3/nuget/NuGetToolGetter', {
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

export function registerNugetToolGetterMockUnix(tmr: tmrm.TaskMockRunner) {
    tmr.registerMock('azure-pipelines-tasks-packaging-common-v3/nuget/NuGetToolGetter', {
        getNuGet: function(versionSpec) {
            return '~/myagent/_work/_tasks/NuGet/nuget.exe';
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

export function registerNugetUtilityMock(tmr: tmrm.TaskMockRunner, projectFile: string[]) {
    tmr.registerMock('azure-pipelines-tasks-packaging-common-v3/nuget/Utility', {
        getPatternsArrayFromInput: function(input) {
            return [input];
        },
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
        getNuGetFeedRegistryUrl(
            packagingCollectionUrl: string,
            feedId: string,
            project: string,
            nuGetVersion: VersionInfo,
            accessToken?: string) {
            if(project) {
                return 'https://vsts/' + project + '/packagesource';
            }
            return 'https://vsts/packagesource';
        }
    } );
    
    tmr.registerMock('./Utility', {
        resolveToolPath: function(path) {
            return path;
        }
    });
}

export function registerNugetUtilityMockUnix(tmr: tmrm.TaskMockRunner, projectFile: string[]) {
    tmr.registerMock('azure-pipelines-tasks-packaging-common-v3/nuget/Utility', {
        getPatternsArrayFromInput: function(input) {
            return [input];
        },
        resolveFilterSpec: function(filterSpec, basePath?, allowEmptyMatch?) {
            return projectFile;
        },
        resolveToolPath: function(path) {
            return path;
        },
        locateCredentialProvider: function(path) {
            return '~/myagent/_work/_tasks/NuGet/CredentialProvider';
        },
        setConsoleCodePage: function() {
            var tlm = require('azure-pipelines-task-lib/mock-task');
            tlm.debug(`setting console code page`);
        },
        getNuGetFeedRegistryUrl(
            packagingCollectionUrl: string,
            feedId: string,
            project: string,
            nuGetVersion: VersionInfo,
            accessToken?: string) {
            return 'https://vsts/packagesource';
        }
    });

    tmr.registerMock('./Utility', {
        resolveToolPath: function(path) {
            return path;
        }
    });
}
