import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'azurepowershell.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const tempDir = os.tmpdir();

// MSRC 129198 (F2): with the sanitizer feature flags OFF (default), the same `;` argument must NOT be
// blocked — the character sanitizer is a no-op so existing pipelines are unaffected.
delete process.env['DISTRIBUTEDTASK_TASKS_ENABLEAZUREPOWERSHELLARGUMENTSSANITIZATION'];
delete process.env['AZP_75787_ENABLE_NEW_LOGIC'];
delete process.env['AZP_75787_ENABLE_NEW_LOGIC_LOG'];
delete process.env['AZP_75787_ENABLE_COLLECT'];

tmr.setInput('ConnectedServiceNameARM', 'AzureRM');
tmr.setInput('ScriptType', 'FilePath');
tmr.setInput('ScriptPath', path.join(tempDir, 'script.ps1'));
tmr.setInput('ScriptArguments', '-Foo bar; Write-Output INJECTED');
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

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": { "pwsh": "/usr/bin/pwsh", "powershell": "" },
    "checkPath": { [tempDir]: true, [path.join(tempDir, 'script.ps1')]: true },
    "exec": {}
};
tmr.setAnswers(a);

tmr.run();
