// Test setup for NuGetToolInstallerV1 L0 tests
import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

export interface NuGetInstallerTestOptions {
    versionSpec?: string;
    checkLatest?: boolean;
    nugetPath?: string;
    shouldFail?: boolean;
    errorMessage?: string;
}

export const TestEnvVars = {
    versionSpec: '__versionSpec__',
    checkLatest: '__checkLatest__',
    nugetPath: '__nugetPath__',
    shouldFail: '__shouldFail__',
    errorMessage: '__errorMessage__'
};

const taskPath = path.join(__dirname, '..', 'nugettoolinstaller.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Read configuration from environment variables
const versionSpec = process.env[TestEnvVars.versionSpec];
const checkLatest = process.env[TestEnvVars.checkLatest] === 'true';
const nugetPath = process.env[TestEnvVars.nugetPath] || 'c:\\nuget\\nuget.exe';
const shouldFail = process.env[TestEnvVars.shouldFail] === 'true';
const errorMessage = process.env[TestEnvVars.errorMessage] || 'NuGet download failed';

// Set task inputs
if (versionSpec) {
    tr.setInput('versionSpec', versionSpec);
}
tr.setInput('checkLatest', checkLatest.toString());

// Mock NuGetToolGetter
const mockNuGetGetter = {
    getNuGet: async (versionSpec: string, checkLatest: boolean, preferLatest: boolean) => {
        if (shouldFail) {
            throw new Error(errorMessage);
        }
        return nugetPath;
    },
    getMSBuildVersionString: async () => {
        return '15.0.0';
    },
    NUGET_EXE_TOOL_PATH_ENV_VAR: 'NuGetExeToolPath'
};

tr.registerMock('azure-pipelines-tasks-packaging-common/nuget/NuGetToolGetter', mockNuGetGetter);

// Mock pe-parser
const mockPeParser = {
    getFileVersionInfoAsync: async (filePath: string) => {
        return {
            fileVersion: {
                major: 5,
                minor: 9,
                patch: 0,
                build: 7134,
                toString: () => '5.9.0.7134'
            },
            strings: {
                'ProductVersion': '5.9.0'
            }
        };
    }
};

tr.registerMock('azure-pipelines-tasks-packaging-common/pe-parser', mockPeParser);

// Mock telemetry
tr.registerMock('azure-pipelines-tasks-utility-common/telemetry', {
    emitTelemetry: (area: string, feature: string, data: any) => {
        // Silent mock
    }
});

tr.run();
