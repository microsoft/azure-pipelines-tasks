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
tmr.setInput('addSpnToEnvironment', 'true');

// Mock Endpoint
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'WorkloadIdentityFederation';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID'] = 'tenantId';
process.env['ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID'] = 'subId';
process.env['ENDPOINT_DATA_AzureRM_ENVIRONMENT'] = 'AzureCloud';

// System access token
process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = '{"scheme":"OAuth","parameters":{"AccessToken":"systemToken"}}';

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    getVariable: {
        'System.JobId': 'jobId',
        'System.PlanId': 'planId',
        'System.TeamProjectId': 'projectId',
        'System.HostType': 'hostType',
        'System.CollectionUri': 'https://dev.azure.com/org/',
        'System.TeamProject': 'Project'
    },
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
        'az login --service-principal -u "spId" --tenant "tenantId" --allow-no-subscriptions --federated-token "federatedToken"': {
            code: 0,
            stdout: 'login ok'
        },
        'az account set --subscription "subId"': {
            code: 0,
            stdout: 'subscription set'
        },
        'az  account clear': {
            code: 0,
            stdout: 'account cleared'
        },
        '/bin/bash /tmp/test.sh': {
            code: 0,
            stdout: 'script ok'
        }
    }
};

tmr.setAnswers(a);

const apiMock = {
    getHandlerFromToken: () => ({}),
    WebApi: class {
        getTaskApi() {
            return {
                createOidcToken: () => Promise.resolve({ oidcToken: 'federatedToken' })
            };
        }
    }
};

tmr.registerMock('azure-devops-node-api', apiMock);

os.type = () => 'Linux';
tmr.registerMock('os', os);
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

tmr.run();
