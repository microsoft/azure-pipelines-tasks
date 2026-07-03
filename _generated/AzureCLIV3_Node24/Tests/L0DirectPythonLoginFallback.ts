import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

const FIXED_TIMESTAMP = 1700000000000;
const RealDate = Date;
(global as any).Date = class extends RealDate {
    constructor(...args: any[]) {
        if (args.length > 0) {
            super(...(args as [any]));
        } else {
            super(FIXED_TIMESTAMP);
        }
    }

    public static now(): number {
        return FIXED_TIMESTAMP;
    }

    public getTime(): number {
        return FIXED_TIMESTAMP;
    }
} as DateConstructor;

let taskPath = path.join(__dirname, '..', 'azureclitask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Inputs
tmr.setInput('connectedServiceNameARM', 'AzureRM');
tmr.setInput('scriptType', 'pscore');
tmr.setInput('scriptLocation', 'inlineScript');
tmr.setInput('inlineScript', 'Write-Host "logged in"');
tmr.setInput('cwd', '/tmp');
tmr.setInput('visibleAzLogin', 'true');
tmr.setInput('useGlobalConfig', 'true');

// Environment variables
process.env['DISTRIBUTEDTASK_TASKS_ENABLELATEBOUNDIDTOKEN'] = 'false';
process.env['DISTRIBUTEDTASK_TASKS_USEAZVERSION'] = 'false';
process.env['SYSTEM_PIPELINESTARTTIME'] = '2026-06-08T00:00:00Z';
process.env['AGENT_OS'] = 'Windows_NT';
process.env['AGENT_TEMPDIRECTORY'] = os.tmpdir();

// Feature flag for -File invocation — ON
process.env['AZP_AZURECLI_USE_FILE_INVOCATION'] = 'true';

// Mock Endpoint
process.env['ENDPOINT_URL_AzureRM'] = 'https://management.azure.com/';
process.env['ENDPOINT_AUTH_AzureRM'] = '{"parameters":{"serviceprincipalid":"spId","serviceprincipalkey":"spKey","tenantid":"tenantId","authenticationType":"spnKey"},"scheme":"ServicePrincipal"}';
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ServicePrincipal';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY'] = 'spKey';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID'] = 'tenantId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_AUTHENTICATIONTYPE'] = 'spnKey';
process.env['ENDPOINT_DATA_AzureRM'] = '{"environment":"AzureCloud"}';

// Mock Telemetry — capture to verify fallback telemetry
tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: (area: string, feature: string, data: any) => {
        console.log(`TELEMETRY: ${area}/${feature} ${JSON.stringify(data)}`);
    }
});

// Mock WebApi
tmr.registerMock('azure-devops-node-api', {
    getHandlerFromToken: () => {},
    WebApi: class {
        getTaskApi() { return Promise.resolve({}); }
    }
});

// Mock azCliUtility (V3-specific)
tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azCliUtility', {
    validateAzModuleVersion: () => Promise.resolve()
});

// Mock argsSanitizer (V3-specific)
tmr.registerMock('./src/argsSanitizer', {
    tryValidateScriptArgs: () => {},
    ArgsSanitizingError: class extends Error {}
});

// Mock AzureCliConfigDir
tmr.registerMock('./src/AzureCliConfigDir', {
    createPerInvocationAzureConfigDir: () => {},
    removePerInvocationAzureConfigDir: () => {}
});

tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

// Mock fs — python.exe does NOT exist (triggers fallback to az.cmd)
const realFs = require('fs');
tmr.registerMock('fs', {
    existsSync: (p: string) => {
        if (p.endsWith('python.exe')) {
            console.log('PYTHON_EXE_CHECK_NOT_FOUND: ' + p);
            return false; // python.exe NOT found — should trigger fallback
        }
        return realFs.existsSync(p);
    },
    writeFileSync: realFs.writeFileSync.bind(realFs),
    unlinkSync: realFs.unlinkSync.bind(realFs),
    readFileSync: realFs.readFileSync.bind(realFs),
    mkdtempSync: realFs.mkdtempSync.bind(realFs)
});

// Mock Utility
tmr.registerMock('./src/Utility', {
    Utility: {
        checkIfAzurePythonSdkIsInstalled: () => true,
        throwIfError: (code: any) => {
            if (code && code.code !== 0) {
                throw code;
            }
        },
        getPowerShellScriptPath: async (location: string, extensions: string[], scriptArguments: string) => {
            return path.join(os.tmpdir(), 'testscript.ps1');
        },
        deleteFile: async (filePath: string) => {}
    }
});

// Mock exec — should use az.cmd fallback, NOT python.exe
const pwshCmd = 'pwsh -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -File ' + path.join(os.tmpdir(), 'azureclitaskscript1700000000000.ps1');
let execAnswers: { [key: string]: { code: number; stdout: string; stderr: string } } = {
    'az version': { 'code': 0, 'stdout': 'azure-cli 2.66.0', 'stderr': '' },
    'az --version': { 'code': 0, 'stdout': 'azure-cli 2.66.0 core 2.66.0 telemetry 1.0.8 extensions 0.4.0', 'stderr': '' },
    'az account clear': { 'code': 0, 'stdout': '', 'stderr': '' },
    // Fallback az.cmd login (visibleAzLogin=true so no --output none)
    'az login --service-principal -u "spId" --password="spKey" --tenant "tenantId" --allow-no-subscriptions': { 'code': 0, 'stdout': '', 'stderr': '' }
};
execAnswers[pwshCmd] = { 'code': 0, 'stdout': '', 'stderr': '' };

let answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': { 'az': 'az', 'pwsh': 'pwsh' },
    'checkPath': { 'az': true, 'pwsh': true },
    'exec': execAnswers
};
tmr.setAnswers(answers);

tmr.run();
