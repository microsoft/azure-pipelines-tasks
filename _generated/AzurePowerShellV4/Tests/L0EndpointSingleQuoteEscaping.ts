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
            return {
                scheme: 'ServicePrincipal',
                displayName: "Contoso's connection",
                auth: { scheme: 'ServicePrincipal' }
            };
        }
    }
});

tmr.registerMock('uuid/v4', () => 'test-uuid');

const fs = require('fs');
const fsClone = Object.assign({}, fs);
fsClone.promises = Object.assign({}, fs.promises, {
    writeFile: (file, data) => {
        const fileContent = String(data);
        if (fileContent.indexOf(`"displayName":"Contoso''s connection"`) < 0) {
            throw new Error('Endpoint single quote was not escaped for a PowerShell single-quoted string');
        }

        console.log('ENDPOINT_SINGLE_QUOTE_ESCAPED');
        return Promise.resolve();
    }
});
tmr.registerMock('fs', fsClone);

const scriptPath = path.join(tempDir, 'test-uuid.ps1');

let answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "pwsh": pwshPath
    },
    "checkPath": {
        [pwshPath]: true,
        [tempDir]: true
    },
    "exec": {
        [`${pwshPath} -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command . '${scriptPath}'`]: {
            "code": 0,
            "stdout": "Main script executed successfully"
        }
    }
};
tmr.setAnswers(answers);

tmr.run();
