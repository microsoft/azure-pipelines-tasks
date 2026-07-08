import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

const taskPath = path.join(__dirname, '..', 'azureclitask.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Use cross-platform temp directory
const tempDir = os.tmpdir();
process.env['AGENT_TEMPDIRECTORY'] = tempDir;

// Inputs
tmr.setInput('connectedServiceNameARM', 'AzureRM');
tmr.setInput('scriptLocation', 'scriptPath');
tmr.setInput('scriptPath', '/tmp/test.sh');
tmr.setInput('cwd', '/tmp');
tmr.setInput('args', '');
tmr.setInput('useGlobalConfig', 'true');
tmr.setInput('failOnStandardError', 'false');

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
        az: 'az',
        bash: '/bin/bash'
    },
    checkPath: {
        '/tmp': true,
        '/tmp/test.sh': true,
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
            code: 1,
            stderr: 'login failed'
        }
    }
};

tmr.setAnswers(a);

os.type = () => 'Linux';
tmr.registerMock('os', os);
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

tmr.run();
