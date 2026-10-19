import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'azurepowershell.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Use OS-agnostic temp dir so the test works on both Windows and Linux/macOS.
const tempDir = os.tmpdir();
const pwshPath = process.platform === 'win32' ? 'C:\\fake\\pwsh.exe' : '/usr/bin/pwsh';

// Inputs
tmr.setInput('ConnectedServiceNameARM', 'AzureRM');
tmr.setInput('ScriptType', 'InlineScript');
tmr.setInput('Inline', 'Write-Host "Hello"');
tmr.setInput('ScriptArguments', '');
tmr.setInput('errorActionPreference', 'Stop');
tmr.setInput('FailOnStandardError', 'false');
tmr.setInput('TargetAzurePs', '');
tmr.setInput('CustomTargetAzurePs', '');
tmr.setInput('workingDirectory', tempDir);

// Agent env
process.env['AGENT_TEMPDIRECTORY'] = tempDir;
process.env['AGENT_VERSION'] = '2.999.0';

// Service connection env vars (should be cleared by best-effort fallback after cleanup fails)
process.env['AZURESUBSCRIPTION_SERVICE_CONNECTION_ID'] = 'test-connection-id';
process.env['AZURESUBSCRIPTION_CLIENT_ID'] = 'test-client-id';
process.env['AZURESUBSCRIPTION_TENANT_ID'] = 'test-tenant-id';

// Mock Endpoint
process.env['ENDPOINT_URL_AzureRM'] = 'https://management.azure.com/';
process.env['ENDPOINT_AUTH_AzureRM'] = '{"parameters":{"serviceprincipalid":"spId","serviceprincipalkey":"spKey","tenantid":"tenantId"},"scheme":"ServicePrincipal"}';
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ServicePrincipal';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID'] = 'tenantId';
process.env['ENDPOINT_DATA_AzureRM'] = '{"environment":"AzureCloud"}';

// Mock azure-arm-endpoint
tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(connectedServiceName: string) { }
        async getEndpoint() {
            return { scheme: 'ServicePrincipal', auth: { scheme: 'ServicePrincipal' } };
        }
    }
});

// Mock azCliUtility
tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azCliUtility', {
    validateAzModuleVersion: () => Promise.resolve()
});

// Mock uuid so the generated script file path is predictable
tmr.registerMock('uuid/v4', () => 'test-uuid');

// Mock fs.writeFile so the task does not actually write to disk
const fs = require('fs');
const fsClone = Object.assign({}, fs);
fsClone.writeFile = function (file, data, options, cb) {
    if (typeof options === 'function') { cb = options; }
    if (typeof cb === 'function') { cb(null); }
};
tmr.registerMock('fs', fsClone);

// Build the script paths that the task will generate
const scriptPath = path.join(tempDir, 'test-uuid.ps1');
const importSdkPath = path.join(__dirname, '..', 'ImportVstsTaskSdk.ps1');
const removeAzCtxPath = path.join(__dirname, '..', 'RemoveAzContext.ps1');

// Answers: pwsh found, main script succeeds (exit 0), cleanup fails (exit 1).
// Expected: task should succeed (main result preserved) with a warning, since cleanup
// must never override the task's actual result.
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "pwsh": pwshPath
    },
    "checkPath": {
        [pwshPath]: true,
        [tempDir]: true
    },
    "exec": {
        [`${pwshPath} -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command . '${importSdkPath}'; . '${scriptPath}'`]: {
            "code": 0,
            "stdout": "Main script executed successfully"
        },
        [`${pwshPath} -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command . '${removeAzCtxPath}'`]: {
            "code": 1,
            "stdout": "Cleanup script failed"
        }
    }
};
tmr.setAnswers(a);

tmr.run();
