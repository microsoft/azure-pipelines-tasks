import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

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
// Inline script with password containing caret
tmr.setInput('inlineScript', `
az sql db export \
  --resource-group 'TestRG' \
  --server-name 'testserver' \
  --name 'testdb' \
  --admin-user 'admin' \
  --admin-password 'Abc123^def456' \
  --storage-uri 'https://test.blob.core.windows.net/backup.bacpac' \
  --storage-key 'testkey' \
  --storage-key-type 'StorageAccessKey'
`);
tmr.setInput('cwd', '/tmp');
tmr.setInput('visibleAzLogin', 'true');

// Environment variables
process.env['DISTRIBUTEDTASK_TASKS_ENABLELATEBOUNDIDTOKEN'] = 'false';
process.env['DISTRIBUTEDTASK_TASKS_USEAZVERSION'] = 'false';
process.env['SYSTEM_PIPELINESTARTTIME'] = '2026-06-08T00:00:00Z';
process.env['AGENT_OS'] = 'Windows_NT';
process.env['AGENT_TEMPDIRECTORY'] = 'C:\\temp';

// Feature flag for -File invocation
process.env['AZP_AZURECLI_USE_FILE_INVOCATION'] = 'true';

// Mock Endpoint with Service Principal key-based authentication
process.env['ENDPOINT_URL_AzureRM'] = 'https://management.azure.com/';
process.env['ENDPOINT_AUTH_AzureRM'] = '{"parameters":{"serviceprincipalid":"spId","serviceprincipalkey":"spKey","tenantid":"tenantId","authenticationType":"spnKey"},"scheme":"ServicePrincipal"}';
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ServicePrincipal';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY'] = 'spKey';
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
            return '/tmp/testscript.ps1';
        },
        deleteFile: async (filePath: string) => {}
    }
});

// Mock az CLI version check and executable resolution
let answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': {
        'az': 'az',
        'pwsh': 'pwsh'
    },
    'checkPath': {
        'az': true,
        'pwsh': true
    },
    'exec': {
        'az version': {
            'code': 0,
            'stdout': 'azure-cli 2.50.0',
            'stderr': ''
        },
        'az --version': {
            'code': 0,
            'stdout': 'azure-cli 2.50.0 core 2.50.0 telemetry 1.0.8 extensions 0.4.0',
            'stderr': ''
        },
        'az account clear': {
            'code': 0,
            'stdout': '',
            'stderr': ''
        },
        'az login --service-principal -u "spId" --password="spKey" --tenant "tenantId" --allow-no-subscriptions': {
            'code': 0,
            'stdout': '',
            'stderr': ''
        },
        'pwsh -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -File C:\\temp\\azureclitaskscript1700000000000.ps1': {
            'code': 0,
            'stdout': '',
            'stderr': ''
        }
    }
};
tmr.setAnswers(answers);

// Run task
tmr.run();
