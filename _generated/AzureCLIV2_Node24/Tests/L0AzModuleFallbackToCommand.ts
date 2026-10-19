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
    public static now(): number { return FIXED_TIMESTAMP; }
    public getTime(): number { return FIXED_TIMESTAMP; }
} as DateConstructor;

let taskPath = path.join(__dirname, '..', 'azureclitask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('connectedServiceNameARM', 'AzureRM');
tmr.setInput('scriptType', 'pscore');
tmr.setInput('scriptLocation', 'inlineScript');
tmr.setInput('inlineScript', 'Write-Host "hello"');
tmr.setInput('cwd', '/tmp');
tmr.setInput('visibleAzLogin', 'true');
tmr.setInput('useGlobalConfig', 'true');

process.env['DISTRIBUTEDTASK_TASKS_ENABLELATEBOUNDIDTOKEN'] = 'false';
process.env['DISTRIBUTEDTASK_TASKS_USEAZVERSION'] = 'false';
process.env['SYSTEM_PIPELINESTARTTIME'] = '2026-06-08T00:00:00Z';
process.env['AGENT_OS'] = 'Windows_NT';
process.env['AGENT_TEMPDIRECTORY'] = os.tmpdir();
process.env['DISTRIBUTEDTASK_TASKS_AZURECLIUSEFILEINVOCATION'] = 'true';

process.env['ENDPOINT_URL_AzureRM'] = 'https://management.azure.com/';
process.env['ENDPOINT_AUTH_AzureRM'] = '{"parameters":{"serviceprincipalid":"spId","serviceprincipalkey":"spKey","tenantid":"tenantId","authenticationType":"spnKey"},"scheme":"ServicePrincipal"}';
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ServicePrincipal';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY'] = 'spKey';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID'] = 'tenantId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_AUTHENTICATIONTYPE'] = 'spnKey';
process.env['ENDPOINT_DATA_AzureRM'] = '{"environment":"AzureCloud"}';

tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: (area: string, feature: string, data: any) => {
        console.log(`TELEMETRY: ${area}/${feature} ${JSON.stringify(data)}`);
    }
});

tmr.registerMock('azure-devops-node-api', {
    getHandlerFromToken: () => {},
    WebApi: class { getTaskApi() { return Promise.resolve({}); } }
});

tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

tmr.registerMock('./src/AzureCliConfigDir', {
    createPerInvocationAzureConfigDir: () => {},
    removePerInvocationAzureConfigDir: () => {}
});

const realFs = require('fs');
tmr.registerMock('fs', {
    existsSync: (p: string) => {
        if (p.endsWith('python.exe')) return false;
        return realFs.existsSync(p);
    },
    writeFileSync: realFs.writeFileSync.bind(realFs),
    unlinkSync: realFs.unlinkSync.bind(realFs),
    readFileSync: realFs.readFileSync.bind(realFs),
    mkdtempSync: realFs.mkdtempSync.bind(realFs),
    statSync: realFs.statSync.bind(realFs)
});

// getPowerShellScriptPathWithAzModule throws to simulate setup failure
// Mock Utility under both paths so ScriptType (./Utility) and azureclitask (./src/Utility) both get the mock
const mockUtility = {
    Utility: {
        checkIfAzurePythonSdkIsInstalled: () => true,
        throwIfError: (code: any) => {
            if (code && code.code !== 0) throw code;
        },
        getPowerShellScriptPathWithAzModule: async () => {
            throw new Error('mkdtempSync failed: ENOSPC');
        },
        getPowerShellScriptPath: async (location: string, extensions: string[], scriptArguments: string) => {
            console.log('FALLBACK_TO_LEGACY_PATH');
            return path.join(os.tmpdir(), 'testscript.ps1');
        },
        deleteFile: async (filePath: string) => {},
        deleteDirectory: (directoryPath: string, reason: string) => {
            console.log(`DELETE_DIRECTORY: ${reason}`);
        }
    }
};
tmr.registerMock('./src/Utility', mockUtility);
tmr.registerMock('./Utility', mockUtility);

const testScriptPath = path.join(os.tmpdir(), 'testscript.ps1');
const scriptCmd = `pwsh -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command . '${testScriptPath.replace(/'/g, "''")}'`;
let execAnswers: { [key: string]: { code: number; stdout: string; stderr: string } } = {
    'az --version': { 'code': 0, 'stdout': 'azure-cli 2.50.0 core 2.50.0', 'stderr': '' },
    'az account clear': { 'code': 0, 'stdout': '', 'stderr': '' },
    'az cloud set -n AzureCloud': { 'code': 0, 'stdout': '', 'stderr': '' },
    'az login --service-principal -u "spId" --password="spKey" --tenant "tenantId" --allow-no-subscriptions': { 'code': 0, 'stdout': '', 'stderr': '' }
};
execAnswers[scriptCmd] = { 'code': 0, 'stdout': '', 'stderr': '' };

let answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': { 'az': 'az', 'pwsh': 'pwsh' },
    'checkPath': { 'az': true, 'pwsh': true },
    'exec': execAnswers
};
tmr.setAnswers(answers);

tmr.run();
