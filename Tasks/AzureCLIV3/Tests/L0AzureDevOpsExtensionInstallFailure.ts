import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'azureclitask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('connectionType', 'azureDevOps');
tmr.setInput('azureDevOpsServiceConnection', 'TestAzureDevOpsConnection');
tmr.setInput('scriptType', 'bash');
tmr.setInput('scriptLocation', 'inlineScript');
tmr.setInput('inlineScript', 'echo "test"');
tmr.setInput('failOnStandardError', 'false');
tmr.setInput('visibleAzLogin', 'false');
tmr.setInput('useGlobalConfig', 'false');
tmr.setInput('cwd', __dirname);

process.env['ENDPOINT_AUTH_TestAzureDevOpsConnection'] = JSON.stringify({
    scheme: 'WorkloadIdentityFederation',
    parameters: {
        serviceprincipalid: 'test-sp-id',
        tenantid: 'test-tenant-id'
    }
});
process.env['ENDPOINT_AUTH_SCHEME_TestAzureDevOpsConnection'] = 'WorkloadIdentityFederation';
process.env['ENDPOINT_AUTH_PARAMETER_TestAzureDevOpsConnection_SERVICEPRINCIPALID'] = 'test-sp-id';
process.env['ENDPOINT_AUTH_PARAMETER_TestAzureDevOpsConnection_TENANTID'] = 'test-tenant-id';

process.env['SYSTEM_COLLECTIONURI'] = 'https://dev.azure.com/testorg/';
process.env['SYSTEM_TEAMPROJECT'] = 'TestProject';
process.env['SYSTEM_JOBID'] = 'test-job-id';
process.env['SYSTEM_PLANID'] = 'test-plan-id';
process.env['SYSTEM_TEAMPROJECTID'] = 'test-project-id';
process.env['SYSTEM_HOSTTYPE'] = 'build';
process.env['AGENT_TEMPDIRECTORY'] = __dirname;

process.env['AZP_AZURECLIV2_SETUP_PROXY_ENV'] = 'false';
process.env['ShowWarningOnOlderAzureModules'] = 'false';
process.env['UseAzVersion'] = 'false';

let mockAnswers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "az": "az",
        "bash": "bash"
    },
    "checkPath": {
        "az": true,
        "bash": true
    },
    "exec": {
        "az --version": {
            "code": 0,
            "stdout": "azure-cli 2.50.0"
        },
        "az extension show --name azure-devops": {
            "code": 1,
            "stdout": "Extension not found"
        },
        "az extension add -n azure-devops -y": {
            "code": 1,
            "stdout": "Failed to install extension: permission denied"
        },
        "bash*": {
            "code": 0,
            "stdout": "test completed"
        },
        "*": {
            "code": 0,
            "stdout": "test completed"
        }
    },
    "exists": {
        "bash": true
    }
};

tmr.setAnswers(mockAnswers);

tmr.registerMock('azure-devops-node-api', {
    getHandlerFromToken: () => ({}),
    WebApi: function() {
        return {
            getTaskApi: () => Promise.resolve({
                createOidcToken: () => Promise.resolve({ oidcToken: 'mock-token' })
            })
        };
    }
});

tmr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', {
    getSystemAccessToken: () => 'system-token'
});

tmr.registerMock('./src/Utility', {
    Utility: {
        throwIfError: (result, message) => {
            if (result && result.code !== 0) {
                throw new Error(message || 'Command failed');
            }
        },
        checkIfAzurePythonSdkIsInstalled: () => true
    }
});

// Mock the task library localization
tmr.setVariableName('FailedToInstallAzureDevOpsCLI', 'loc_mock_FailedToInstallAzureDevOpsCLI');

tmr.registerMock('./src/ScriptType', {
    ScriptTypeFactory: {
        getScriptType: () => ({
            getTool: () => Promise.resolve({
                on: () => {},
                exec: () => Promise.resolve(0)
            }),
            cleanUp: () => Promise.resolve()
        })
    }
});

tmr.run();