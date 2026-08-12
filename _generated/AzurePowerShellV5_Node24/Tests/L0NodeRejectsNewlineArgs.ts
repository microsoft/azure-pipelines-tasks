// MSRC 129198: the Node handler (Linux/macOS) must reject a CR/LF in ScriptArguments before it
// reaches the dot-source sink `. 'script.ps1' <args>`, matching the Windows handler.
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'azurepowershell.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const tempDir = os.tmpdir();
const scriptPath = path.join(tempDir, 'script.ps1');

tmr.setInput('ConnectedServiceNameARM', 'AzureRM');
tmr.setInput('ScriptType', 'FilePath');
tmr.setInput('ScriptPath', scriptPath);
tmr.setInput('ScriptArguments', "-Foo bar\nWrite-Host INJECTED_129198");
tmr.setInput('errorActionPreference', 'Stop');
tmr.setInput('FailOnStandardError', 'false');
tmr.setInput('TargetAzurePs', '');
tmr.setInput('CustomTargetAzurePs', '');
tmr.setInput('workingDirectory', tempDir);

process.env['AGENT_TEMPDIRECTORY'] = tempDir;
process.env['AGENT_VERSION'] = '2.999.0';
process.env['ENDPOINT_URL_AzureRM'] = 'https://management.azure.com/';
process.env['ENDPOINT_AUTH_AzureRM'] = '{"parameters":{"serviceprincipalid":"spId","serviceprincipalkey":"spKey","tenantid":"tenantId"},"scheme":"ServicePrincipal"}';
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ServicePrincipal';
process.env['ENDPOINT_DATA_AzureRM'] = '{"environment":"AzureCloud"}';

// The reject fires before endpoint resolution, but mock it so an unexpected code path can't hang.
tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint', {
    AzureRMEndpoint: class {
        constructor(connectedServiceName: string) {}
        async getEndpoint() { return { scheme: 'ServicePrincipal', auth: { scheme: 'ServicePrincipal' } }; }
    }
});
tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azCliUtility', {
    validateAzModuleVersion: () => Promise.resolve()
});
tmr.registerMock('uuid/v4', () => 'test-uuid');

const fs = require('fs');
const fsClone = Object.assign({}, fs);
fsClone.writeFile = function (file, data, options, cb) {
    if (typeof options === 'function') { cb = options; }
    if (typeof cb === 'function') { cb(null); }
};
tmr.registerMock('fs', fsClone);

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": { "pwsh": "/usr/bin/pwsh", "powershell": "" },
    "checkPath": { [tempDir]: true, [scriptPath]: true },
    "stats": { [scriptPath]: { "isFile": true } },
    "exec": {}
};
tmr.setAnswers(a);

tmr.run();
