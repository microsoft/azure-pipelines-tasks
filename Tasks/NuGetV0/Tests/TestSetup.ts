import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as path from 'path';
import * as testConstants from './TestConstants';
import VersionInfoVersion from 'azure-pipelines-tasks-packaging-common-v3/pe-parser/VersionInfoVersion';
import { VersionInfo } from 'azure-pipelines-tasks-packaging-common-v3/pe-parser/VersionResource';
import * as pkgMock from 'azure-pipelines-tasks-packaging-common-v3/Tests/MockHelper';

// Get the task path
const taskPath = path.join(__dirname, '..', 'nuget.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Read test configuration from environment variables
const command = process.env[testConstants.TestEnvVars.command] || 'testCommand';
const args = process.env[testConstants.TestEnvVars.arguments] || '';
const nuGetVersion = process.env[testConstants.TestEnvVars.nuGetVersion] || testConstants.TestData.defaultVersion;
const nuGetVersionInfo: number[] = process.env[testConstants.TestEnvVars.nuGetVersionInfo]
    ? JSON.parse(process.env[testConstants.TestEnvVars.nuGetVersionInfo])
    : testConstants.TestData.defaultVersionInfo;
const nuGetExePath = process.env[testConstants.TestEnvVars.nuGetExePath] || '';
const getNuGetShouldFail = process.env[testConstants.TestEnvVars.getNuGetShouldFail] === 'true';
const packagingLocationShouldFail = process.env[testConstants.TestEnvVars.packagingLocationShouldFail] === 'true';
const nuGetExitCode = parseInt(process.env[testConstants.TestEnvVars.nuGetExitCode] || '0');

// Determine actual NuGet path
const effectiveNuGetPath = nuGetExePath || testConstants.TestData.defaultNuGetPath;

// Set environment variables
process.env['AGENT_HOMEDIRECTORY'] = testConstants.TestData.agentHomeDir;
process.env['BUILD_SOURCESDIRECTORY'] = testConstants.TestData.buildSourceDir;
process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = '{"parameters":{"AccessToken":"token"},"scheme":"OAuth"}';
process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = testConstants.TestData.defaultServiceUri;
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = testConstants.TestData.agentHomeDir;
process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = testConstants.TestData.defaultCollectionUri;

if (nuGetExePath) {
    process.env['NUGET_EXE_TOOL_PATH'] = nuGetExePath;
}

// Set extra URL prefixes variable if provided
const extraUrlPrefixes = process.env[testConstants.TestEnvVars.extraUrlPrefixes] || '';
if (extraUrlPrefixes) {
    process.env['NUGETTASKS_EXTRAURLPREFIXESFORTESTING'] = extraUrlPrefixes;
}

// Set task inputs
tr.setInput('command', command);
if (args) {
    tr.setInput('arguments', args);
}

// Register location helpers mock
pkgMock.registerLocationHelpersMock(tr);

// Mock packaging location utilities
tr.registerMock('azure-pipelines-tasks-packaging-common-v3/locationUtilities', {
    getPackagingUris: async function (protocolType: any) {
        if (packagingLocationShouldFail) {
            throw new Error('Unable to get packaging URIs');
        }
        return {
            PackagingUris: [
                'https://example.visualstudio.com/defaultcollection/'
            ]
        };
    },
    ProtocolType: {
        NuGet: 'NuGet'
    },
    getSystemAccessToken: function () {
        return process.env[testConstants.TestEnvVars.systemAccessToken] || 'token';
    }
});

// Mock NuGet tool getter
tr.registerMock('azure-pipelines-tasks-packaging-common-v3/nuget/NuGetToolGetter', {
    NUGET_EXE_TOOL_PATH_ENV_VAR: 'NUGET_EXE_TOOL_PATH',
    getNuGet: async function (versionSpec: string) {
        if (getNuGetShouldFail) {
            throw new Error('Failed to get NuGet tool');
        }
        return testConstants.TestData.defaultNuGetPath;
    }
});

// Mock PE parser with configurable version
tr.registerMock('azure-pipelines-tasks-packaging-common-v3/pe-parser/index', {
    getFileVersionInfoAsync: function (nuGetExePath: string) {
        let result: VersionInfo = { strings: {} };
        result.fileVersion = new VersionInfoVersion(nuGetVersionInfo[0], nuGetVersionInfo[1], nuGetVersionInfo[2], nuGetVersionInfo[3]);
        result.productVersion = new VersionInfoVersion(nuGetVersionInfo[0], nuGetVersionInfo[1], nuGetVersionInfo[2], nuGetVersionInfo[3]);
        result.strings['ProductVersion'] = nuGetVersion;
        return result;
    }
});

// Internal PE parser mock
tr.registerMock('../pe-parser', {
    getFileVersionInfoAsync: function (nuGetExePath: string) {
        let result: VersionInfo = { strings: {} };
        result.fileVersion = new VersionInfoVersion(nuGetVersionInfo[0], nuGetVersionInfo[1], nuGetVersionInfo[2], nuGetVersionInfo[3]);
        result.strings['ProductVersion'] = nuGetVersion;
        return result;
    }
});

// Mock NuGet utility
tr.registerMock('azure-pipelines-tasks-packaging-common-v3/nuget/Utility', {
    resolveFilterSpec: function (filterSpec: string, basePath?: string, allowEmptyMatch?: boolean) {
        return ['c:\\agent\\home\\directory\\single.sln'];
    },
    stripLeadingAndTrailingQuotes: function (path: string) {
        return path;
    },
    locateCredentialProvider: function (path: string) {
        return testConstants.TestData.credProviderPath;
    },
    setConsoleCodePage: function () {
        var tlm = require('azure-pipelines-task-lib/mock-task');
        tlm.debug('setting console code page');
    }
});

tr.registerMock('./Utility', {
    resolveToolPath: function (path: string) {
        return path;
    }
});

// Mock util
tr.registerMock('azure-pipelines-tasks-packaging-common-v3/util', {
    logError: function (error: any) {
        console.log(`Mock util.logError: ${error}`);
    }
});

// Mock toolrunner
var mtt = require('azure-pipelines-task-lib/mock-toolrunner');
tr.registerMock('azure-pipelines-task-lib/toolrunner', mtt);

// Build exec command string
let execCmd = `${effectiveNuGetPath} ${command} -NonInteractive`;
if (args) {
    execCmd += ` ${args}`;
}

let execAnswers: { [key: string]: any } = {};
execAnswers[execCmd] = {
    code: nuGetExitCode,
    stdout: nuGetExitCode === 0 ? testConstants.TestData.defaultOutput : 'NuGet error: operation failed',
    stderr: ''
};

// Provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    osType: {
        osType: 'Windows_NT'
    },
    checkPath: {},
    which: {},
    exec: execAnswers,
    exist: {
        ['c:\\agent\\home\\directory\\externals\\nuget\\nuget.exe']: true,
        ['c:\\agent\\home\\directory\\externals\\nuget\\CredentialProvider\\CredentialProvider.TeamBuild.exe']: true
    },
    stats: {}
};
tr.setAnswers(a);

tr.run();
