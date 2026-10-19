import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

// L0 mock for the 'Threw' cleanup branch:
//   - pwsh IS resolved (so resolvedPwshPath is set)
//   - main script exec resolves with code 0
//   - cleanup script exec REJECTS (no answer registered for the cleanup command,
//     so mock-runner makes powershell.exec() reject) -> catch block fires,
//     cleanupOutcome = 'Threw' while cleanupExitCode stays 0.
//
// Verifies:
//   - task succeeds (cleanup must never override the main result)
//   - 'Azure context cleanup failed:' warning is emitted (catch branch)
//   - the old 'Cleanup failed with error message:' setResult(Failed,...) is NOT emitted
//   - the env-var-clear gate fires for the Threw branch (previously was skipped
//     because cleanupExitCode was still 0 from its initializer)

let taskPath = path.join(__dirname, '..', 'azurepowershell.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

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

// Service connection env vars - the test asserts they are cleared after the
// cleanup throws (the bug being fixed).
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

tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azCliUtility', {
    validateAzModuleVersion: () => Promise.resolve()
});

tmr.registerMock('uuid/v4', () => 'test-uuid');

// Mock fs.writeFile so the task does not actually write to disk
const fs = require('fs');
const fsClone = Object.assign({}, fs);
fsClone.writeFile = function (file, data, options, cb) {
    if (typeof options === 'function') { cb = options; }
    if (typeof cb === 'function') { cb(null); }
};
tmr.registerMock('fs', fsClone);

const scriptPath = path.join(tempDir, 'test-uuid.ps1');
const importSdkPath = path.join(__dirname, '..', 'ImportVstsTaskSdk.ps1');

// Answers: pwsh resolves, main exec returns code 0.
// IMPORTANT: do NOT register an answer for the cleanup (RemoveAzContext.ps1)
// command. mock-runner will then reject the exec() promise, which is exactly the
// 'Threw' branch we want to cover.
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
        }
        // Intentionally no entry for the cleanup RemoveAzContext.ps1 command.
    }
};
tmr.setAnswers(a);

tmr.run();
