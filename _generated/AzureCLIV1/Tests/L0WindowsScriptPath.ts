import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

const taskPath = path.join(__dirname, '..', 'azureclitask.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['AGENT_TEMPDIRECTORY'] = 'C:\\Windows\\Temp';

const scriptPath = 'C:\\agent\\_work\\1\\s\\script.bat';

// Inputs
tmr.setInput('connectedServiceNameARM', 'AzureRM');
tmr.setInput('scriptLocation', 'scriptPath');
tmr.setInput('scriptPath', scriptPath);
tmr.setInput('cwd', 'C:\\agent\\_work\\1\\s');
tmr.setInput('args', 'arg1');
tmr.setInput('useGlobalConfig', 'true');

// Mock Endpoint
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ServicePrincipal';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_AUTHENTICATIONTYPE'] = 'spnKey';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY'] = 'spKey';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID'] = 'tenantId';
process.env['ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID'] = 'subId';
process.env['ENDPOINT_DATA_AzureRM_ENVIRONMENT'] = 'AzureCloud';

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    which: {
        az: 'C:\\Program Files\\AzureCLI\\az.cmd',
        [scriptPath]: scriptPath
    },
    checkPath: {
        'C:\\agent\\_work\\1\\s': true,
        [scriptPath]: true,
        'C:\\Program Files\\AzureCLI\\az.cmd': true
    },
    exec: {
        'C:\\Program Files\\AzureCLI\\az.cmd --version': {
            code: 0,
            stdout: 'azure-cli 2.0.0'
        },
        'C:\\Program Files\\AzureCLI\\az.cmd cloud set -n AzureCloud': {
            code: 0,
            stdout: 'cloud set'
        },
        'C:\\Program Files\\AzureCLI\\az.cmd login --service-principal -u "spId" --password="spKey" --tenant "tenantId"': {
            code: 0,
            stdout: 'login ok'
        },
        'C:\\Program Files\\AzureCLI\\az.cmd account set --subscription "subId"': {
            code: 0,
            stdout: 'subscription set'
        },
        'C:\\Program Files\\AzureCLI\\az.cmd  account clear': {
            code: 0,
            stdout: 'account cleared'
        },
        [`${scriptPath} arg1`]: {
            code: 0,
            stdout: 'script ok'
        }
    }
};

tmr.setAnswers(a);

os.type = () => 'Windows_NT';
tmr.registerMock('os', os);
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

tmr.run();
