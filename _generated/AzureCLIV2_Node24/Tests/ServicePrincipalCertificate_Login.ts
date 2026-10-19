import assert = require('assert');
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as fs from 'fs';

const tmr = new tmrm.TaskMockRunner(path.join(__dirname, '..', 'azureclitask.js'));
const agentTemp = fs.mkdtempSync(path.join(__dirname, '.certificate login-'));
process.once('exit', () => {
    fs.rmSync(agentTemp, { recursive: true, force: true });
});
const directoryPath = path.join(agentTemp, '.azclitask-credentials-mocked');
const certificatePath = path.join(directoryPath, 'spnCert.pem');

tmr.setInput('connectedServiceNameARM', 'AzureRM');
tmr.setInput('scriptType', 'bash');
tmr.setInput('scriptLocation', 'inlineScript');
tmr.setInput('inlineScript', 'echo hello');
tmr.setInput('cwd', __dirname);
tmr.setInput('visibleAzLogin', 'true');
tmr.setInput('useGlobalConfig', 'true');

process.env['AGENT_TEMPDIRECTORY'] = agentTemp;
process.env['DISTRIBUTEDTASK_TASKS_AZURECLICREDENTIALFILEISOLATIONENABLED'] = 'true';
process.env['DISTRIBUTEDTASK_TASKS_ENABLELATEBOUNDIDTOKEN'] = 'false';
process.env['DISTRIBUTEDTASK_TASKS_USEAZVERSION'] = 'false';
process.env['DISTRIBUTEDTASK_TASKS_AZURECLIUSEFILEINVOCATION'] = 'false';
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ServicePrincipal';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_AUTHENTICATIONTYPE'] = 'spnCertificate';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALCERTIFICATE'] = 'CERTIFICATE';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID'] = 'tenantId';
process.env['ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID'] = 'subId';

tmr.registerMock('./src/AzureCliCredentialFile', {
    createServicePrincipalCertificate: (root: string, content: string) => {
        assert.strictEqual(root, agentTemp);
        assert.strictEqual(content, 'CERTIFICATE');
        console.log('isolated certificate created');
        return { certificatePath, directoryPath };
    },
    removeServicePrincipalCertificate: (certificate: string, directory: string) => {
        assert.strictEqual(certificate, certificatePath);
        assert.strictEqual(directory, directoryPath);
        console.log('isolated certificate removed');
    }
});
tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', { emitTelemetry: () => {} });
tmr.registerMock('azure-devops-node-api', {});
tmr.registerMock('./src/Utility', {
    Utility: {
        checkIfAzurePythonSdkIsInstalled: () => true,
        throwIfError: (result: any) => {
            if (result.code !== 0) {
                throw result;
            }
        }
    }
});
tmr.registerMock('./src/ScriptType', {
    ScriptTypeFactory: {
        getSriptType: () => ({
            getTool: async () => ({ exec: async () => 0, on: () => {} }),
            cleanUp: async () => {}
        })
    }
});
tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azCliUtility', {
    validateAzModuleVersion: async () => {}
});
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

const answers: ma.TaskLibAnswers = {
    which: { az: 'az' },
    checkPath: { az: true },
    exec: {
        'az --version': { code: 0, stdout: 'azure-cli 2.66.0' },
        [`az login --service-principal -u "spId" --certificate="${certificatePath}" --tenant "tenantId" --allow-no-subscriptions`]: {
            code: 0
        },
        'az account set --subscription "subId"': { code: 0 },
        'az account clear': { code: 0 }
    }
};
tmr.setAnswers(answers);
tmr.run();
