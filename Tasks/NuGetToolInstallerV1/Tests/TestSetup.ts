import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';
import * as testConstants from './TestConstants';

// Get the task path
const taskPath = path.join(__dirname, '..', 'nugettoolinstaller.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Read test configuration from environment variables
const versionSpec = process.env[testConstants.TestEnvVars.versionSpec] || '';
const checkLatest = process.env[testConstants.TestEnvVars.checkLatest] || 'false';
const getNuGetShouldFail = process.env[testConstants.TestEnvVars.getNuGetShouldFail] === 'true';
const getNuGetFailMessage = process.env[testConstants.TestEnvVars.getNuGetFailMessage] || 'Failed to download NuGet';
const msBuildVersion = process.env[testConstants.TestEnvVars.msBuildVersion] || '';
const nuGetVersion = process.env[testConstants.TestEnvVars.nuGetVersion] || testConstants.TestData.defaultNuGetVersion;
const nuGetVersionInfo: number[] = process.env[testConstants.TestEnvVars.nuGetVersionInfo]
    ? JSON.parse(process.env[testConstants.TestEnvVars.nuGetVersionInfo])
    : testConstants.TestData.defaultNuGetVersionInfo;
const throwTelemetryError = process.env[testConstants.TestEnvVars.throwTelemetryError] === 'true';
const nullVersionInfo = process.env[testConstants.TestEnvVars.nullVersionInfo] === 'true';

// Set task inputs
if (versionSpec) {
    tr.setInput('versionSpec', versionSpec);
}
tr.setInput('checkLatest', checkLatest);

// Mock NuGet tool getter
// V1 uses `import * as nuGetGetter` so the mock module path is the same
tr.registerMock('azure-pipelines-tasks-packaging-common/nuget/NuGetToolGetter', {
    NUGET_EXE_TOOL_PATH_ENV_VAR: 'NUGET_EXE_TOOL_PATH',
    getNuGet: async function (versionSpecParam: string, checkLatestParam?: boolean, addNuGetToPath?: boolean) {
        console.log(`Mock: getNuGet called with versionSpec=${versionSpecParam}, checkLatest=${checkLatestParam}`);
        if (getNuGetShouldFail) {
            throw new Error(getNuGetFailMessage);
        }
        return testConstants.TestData.defaultNuGetPath;
    },
    // V1 calls getMSBuildVersionString (returns string) instead of getMSBuildVersion (returns SemVer)
    getMSBuildVersionString: async function () {
        console.log(`Mock: getMSBuildVersionString called`);
        if (msBuildVersion) {
            return msBuildVersion;
        }
        return undefined;
    }
});

// Mock PE parser
tr.registerMock('azure-pipelines-tasks-packaging-common/pe-parser', {
    getFileVersionInfoAsync: async function (filePath: string) {
        console.log(`Mock: getFileVersionInfoAsync called with ${filePath}`);
        if (nullVersionInfo) {
            return { strings: { 'ProductVersion': nuGetVersion } };
        }
        return {
            fileVersion: {
                a: nuGetVersionInfo[0],
                b: nuGetVersionInfo[1],
                c: nuGetVersionInfo[2],
                d: nuGetVersionInfo[3],
                toString: function () {
                    return `${nuGetVersionInfo[0]}.${nuGetVersionInfo[1]}.${nuGetVersionInfo[2]}.${nuGetVersionInfo[3]}`;
                }
            },
            strings: {
                'ProductVersion': nuGetVersion
            }
        };
    }
});

// Mock telemetry
tr.registerMock('azure-pipelines-tasks-utility-common/telemetry', {
    emitTelemetry: function (area: string, feature: string, data: any) {
        if (throwTelemetryError) {
            throw new Error('Simulated telemetry error');
        }
        console.log(`Telemetry emitted: ${area}.${feature} with data: ${JSON.stringify(data)}`);
    }
});

tr.run();
