import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

const taskPath = path.join(__dirname, '..', 'azureclitask.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Use os.tmpdir() to get the system's actual temp directory (cross-platform)
const tempDir = os.tmpdir();
process.env['AGENT_TEMPDIRECTORY'] = tempDir;

const fixedTime = 1700000000000;
const RealDate = Date;
(global as any).Date = class extends RealDate {
    constructor() {
        super(fixedTime);
    }
    static now() {
        return fixedTime;
    }
} as any;

// Inputs
tmr.setInput('connectedServiceNameARM', 'AzureRM');
tmr.setInput('scriptLocation', 'inlineScript');
tmr.setInput('inlineScript', 'echo hello');
tmr.setInput('cwd', '/tmp');
tmr.setInput('args', 'arg1');
tmr.setInput('useGlobalConfig', 'false');

// Mock Endpoint
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ServicePrincipal';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_AUTHENTICATIONTYPE'] = 'spnKey';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY'] = 'spKey';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID'] = 'tenantId';
process.env['ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID'] = 'subId';
process.env['ENDPOINT_DATA_AzureRM_ENVIRONMENT'] = 'AzureCloud';

const scriptPath = path.join(tempDir, `azureclitaskscript${fixedTime}.sh`);

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    which: {
        az: 'az',
        bash: '/bin/bash'
    },
    checkPath: {
        '/tmp': true,
        '/bin/bash': true,
        'az': true
    },
    exec: {
        'az --version': {
            code: 0,
            stdout: 'azure-cli 2.0.0'
        },
        'az cloud set -n AzureCloud': {
            code: 0,
            stdout: 'cloud set'
        },
        'az login --service-principal -u "spId" --password="spKey" --tenant "tenantId"': {
            code: 0,
            stdout: 'login ok'
        },
        'az account set --subscription "subId"': {
            code: 0,
            stdout: 'subscription set'
        },
        'az account clear': {
            code: 0,
            stdout: 'account cleared'
        },
        ['/bin/bash ' + scriptPath + ' arg1']: {
            code: 0,
            stdout: 'script ok'
        }
    }
};

tmr.setAnswers(a);

const fs = require('fs');
const fsClone = Object.assign({}, fs);
fsClone.writeFileSync = function () { };
fsClone.existsSync = function (filePath) {
    return filePath === scriptPath;
};
fsClone.unlinkSync = function () { };

tmr.registerMock('fs', fsClone);

os.type = () => 'Linux';
os.tmpdir = () => tempDir;
tmr.registerMock('os', os);
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

tmr.run();

console.log(`AZURE_CONFIG_DIR=${process.env.AZURE_CONFIG_DIR}`);
