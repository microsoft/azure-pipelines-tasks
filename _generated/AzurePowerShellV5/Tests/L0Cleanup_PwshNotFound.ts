import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'azurepowershell.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Use OS-agnostic temp dir so the test works on both Windows and Linux/macOS
const tempDir = os.tmpdir();

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
        constructor(connectedServiceName: string) {}
        async getEndpoint() {
            return { scheme: 'ServicePrincipal', auth: { scheme: 'ServicePrincipal' } };
        }
    }
});

// Mock azCliUtility
tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azCliUtility', {
    validateAzModuleVersion: () => Promise.resolve()
});

// Mock uuid
tmr.registerMock('uuid/v4', () => 'test-uuid');

// Mock fs.writeFile so the task does not actually write to disk
const fs = require('fs');
const fsClone = Object.assign({}, fs);
fsClone.writeFile = function (file, data, options, cb) {
    if (typeof options === 'function') { cb = options; }
    if (typeof cb === 'function') { cb(null); }
};
tmr.registerMock('fs', fsClone);

// Answers: pwsh NOT found — tl.which returns empty, tl.which(x, true) throws.
// This simulates the scenario where pwsh is not on PATH at all.
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "pwsh": "",
        "powershell": ""
    },
    "checkPath": {
        [tempDir]: true
    },
    "exec": {}
};
tmr.setAnswers(a);

tmr.run();
