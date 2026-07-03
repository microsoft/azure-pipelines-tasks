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

// Environment variables
process.env['DISTRIBUTEDTASK_TASKS_ENABLELATEBOUNDIDTOKEN'] = 'false';
process.env['DISTRIBUTEDTASK_TASKS_USEAZVERSION'] = 'false';
process.env['SYSTEM_PIPELINESTARTTIME'] = '2026-06-08T00:00:00Z';
process.env['AGENT_OS'] = 'Windows_NT';
process.env['AGENT_TEMPDIRECTORY'] = os.tmpdir();

// Feature flag for -File invocation
process.env['AZP_AZURECLI_USE_FILE_INVOCATION'] = 'true';

// Mock Endpoint — password contains % characters
process.env['ENDPOINT_URL_AzureRM'] = 'https://management.azure.com/';
process.env['ENDPOINT_AUTH_AzureRM'] = '{"parameters":{"serviceprincipalid":"spId","serviceprincipalkey":"Pa%ss%wo^rd","tenantid":"tenantId","authenticationType":"spnKey"},"scheme":"ServicePrincipal"}';
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ServicePrincipal';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY'] = 'Pa%ss%wo^rd';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID'] = 'tenantId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_AUTHENTICATIONTYPE'] = 'spnKey';
process.env['ENDPOINT_DATA_AzureRM'] = '{"environment":"AzureCloud"}';

// Mock Telemetry
tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: () => {}
});

// Mock WebApi
tmr.registerMock('azure-devops-node-api', {
    getHandlerFromToken: () => {},
    WebApi: class {
        getTaskApi() { return Promise.resolve({}); }
    }
});

tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

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

// Mock exec — password with % and ^ characters passes through direct python login
const pwshCmd = 'pwsh -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -File ' + path.join(os.tmpdir(), 'azureclitaskscript1700000000000.ps1');
const pythonLoginCmd = path.join(path.dirname(path.dirname('az')), 'python.exe') + ' -IBm azure.cli login --service-principal -u "spId" --password="Pa%ss%wo^rd" --tenant "tenantId" --allow-no-subscriptions';
let execAnswers: { [key: string]: { code: number; stdout: string; stderr: string } } = {
    'az version': { 'code': 0, 'stdout': 'azure-cli 2.50.0', 'stderr': '' },
    'az --version': { 'code': 0, 'stdout': 'azure-cli 2.50.0 core 2.50.0 telemetry 1.0.8 extensions 0.4.0', 'stderr': '' },
    'az account clear': { 'code': 0, 'stdout': '', 'stderr': '' },
    // Direct python login with % in password — should work when FF is on
    'az login --service-principal -u "spId" --password="Pa%ss%wo^rd" --tenant "tenantId" --allow-no-subscriptions': { 'code': 0, 'stdout': '', 'stderr': '' }
};
execAnswers[pwshCmd] = { 'code': 0, 'stdout': '', 'stderr': '' };

let answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': { 'az': 'az', 'pwsh': 'pwsh' },
    'checkPath': { 'az': true, 'pwsh': true },
    'exec': execAnswers
};
tmr.setAnswers(answers);

tmr.run();
