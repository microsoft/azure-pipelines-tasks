/* import ma = require('azure-pipelines-task-lib/mock-answer');
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
tmr.setInput('cwd', 'C:\\test');

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
process.env['SYSTEM_JOBID'] = 'job-123';
process.env['SYSTEM_PLANID'] = 'plan-456';
process.env['SYSTEM_TEAMPROJECTID'] = 'project-789';
process.env['SYSTEM_HOSTTYPE'] = 'build';
process.env['AGENT_TEMPDIRECTORY'] = 'C:\\ado\\temp';

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
            "code": 0,
            "stdout": "Azure DevOps CLI extension installed"
        },
        "az login --service-principal -u \"test-sp-id\" --tenant \"test-tenant-id\" --allow-no-subscriptions --federated-token \"mock-token\" --output none": {
            "code": 0,
            "stdout": "Login successful"
        },
        // This will fail to test FailedToSetAzureDevOpsOrganization error message
        "az devops configure --defaults organization=\"https://dev.azure.com/testorg/\"": {
            "code": 1,
            "stdout": "Failed to configure organization"
        },
        "az devops configure --defaults project='' organization=": {
            "code": 0,
            "stdout": "configuration cleared"
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
        "bash": true,
        "C:\\ado\\temp": true,
        "C:\\ado": true
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

// Mock the task library localization for organization error
tmr.setVariableName('FailedToSetAzureDevOpsOrganization', 'loc_mock_FailedToSetAzureDevOpsOrganization');

tmr.registerMock('./src/Utility', {
    Utility: {
        throwIfError: (result: any, message: string) => {
            if (result && result.code !== 0) {
                throw new Error(message);
            }
        },
        checkIfAzurePythonSdkIsInstalled: () => true
    }
});

tmr.registerMock('./src/ScriptType', {
    ScriptTypeFactory: {
        getScriptType: () => ({
            getTool: () => Promise.resolve({
                on: (event: string, callback: Function) => {
                    // Mock event handler
                },
                exec: (options: any) => {
                    console.log('Mock script execution successful');
                    return Promise.resolve(0);
                }
            }),
            cleanUp: () => Promise.resolve()
        })
    }
});

tmr.run(); */