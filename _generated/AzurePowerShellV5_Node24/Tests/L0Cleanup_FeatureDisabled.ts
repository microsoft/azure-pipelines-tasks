import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'azurepowershell.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const tempDir = os.tmpdir();
const pwshPath = process.platform === 'win32' ? 'C:\\fake\\pwsh.exe' : '/usr/bin/pwsh';

tmr.setInput('ConnectedServiceNameARM', 'AzureRM');
tmr.setInput('ScriptType', 'InlineScript');
tmr.setInput('Inline', 'Write-Host "Hello"');
tmr.setInput('ScriptArguments', '');
tmr.setInput('errorActionPreference', 'Stop');
tmr.setInput('FailOnStandardError', 'false');
tmr.setInput('TargetAzurePs', '');
tmr.setInput('CustomTargetAzurePs', '');
tmr.setInput('workingDirectory', tempDir);

process.env['AGENT_TEMPDIRECTORY'] = tempDir;
process.env['AGENT_VERSION'] = '2.999.0';
delete process.env['DISTRIBUTEDTASK_TASKS_CLEANUPAZUREPOWERSHELLTEMPSCRIPT'];
process.env['ENDPOINT_URL_AzureRM'] = 'https://management.azure.com/';
process.env['ENDPOINT_AUTH_AzureRM'] = '{"parameters":{"serviceprincipalid":"spId","serviceprincipalkey":"spKey","tenantid":"tenantId"},"scheme":"ServicePrincipal"}';
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ServicePrincipal';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID'] = 'tenantId';
process.env['ENDPOINT_DATA_AzureRM'] = '{"environment":"AzureCloud"}';

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

const fs = require('fs');
const fsClone = Object.assign({}, fs);
fsClone.promises = Object.assign({}, fs.promises, {
    writeFile: (file, data, options) => {
        if (options.mode !== 0o600) {
            throw new Error('Temporary script permissions were not restricted to the current user');
        }

        return Promise.resolve();
    }
});
fsClone.unlinkSync = function (file) {
    console.log(`TEMP_SCRIPT_REMOVED:${file}`);
};
tmr.registerMock('fs', fsClone);

const scriptPath = path.join(tempDir, 'test-uuid.ps1');
const importSdkPath = path.join(__dirname, '..', 'ImportVstsTaskSdk.ps1');
const removeAzContextPath = path.join(__dirname, '..', 'RemoveAzContext.ps1');

let answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
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
        [`${pwshPath} -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command . '${removeAzContextPath}'`]: {
            "code": 0,
            "stdout": "Cleanup completed"
        }
    }
};
tmr.setAnswers(answers);

tmr.run();
