import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');
import assert = require('assert');

const taskPath = path.join(__dirname, '..', 'azureclitask.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Use os.tmpdir() to get the system's actual temp directory (cross-platform)
const tempDir = os.tmpdir();
process.env['AGENT_TEMPDIRECTORY'] = tempDir;
const directoryPath = path.join(tempDir, '.azclitask-credentials-mocked');
const certificatePath = path.join(directoryPath, 'spnCert.pem');

// Inputs
tmr.setInput('connectedServiceNameARM', 'AzureRM');
tmr.setInput('scriptLocation', 'scriptPath');
tmr.setInput('scriptPath', '/tmp/test.sh');
tmr.setInput('cwd', '/tmp');
tmr.setInput('args', '');
tmr.setInput('useGlobalConfig', 'true');

// Mock Endpoint
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ServicePrincipal';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_AUTHENTICATIONTYPE'] = 'spnCertificate';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALCERTIFICATE'] = 'CERTDATA';
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
        [`az login --service-principal -u "spId" --password="${certificatePath}" --tenant "tenantId"`]: {
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

tmr.registerMock('./src/AzureCliCredentialFile', {
    createServicePrincipalCertificate: (root: string, content: string) => {
        assert.strictEqual(root, tempDir);
        assert.strictEqual(content, 'CERTDATA');
        console.log('isolated certificate created');
        return { certificatePath, directoryPath };
    },
    removeServicePrincipalCertificate: (certificate: string, directory: string) => {
        assert.strictEqual(certificate, certificatePath);
        assert.strictEqual(directory, directoryPath);
        console.log('isolated certificate removed');
    }
});

os.type = () => 'Linux';
tmr.registerMock('os', os);
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

tmr.run();
