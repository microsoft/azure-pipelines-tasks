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

process.env['ENDPOINT_DATA_TestAzureDevOpsConnection'] = JSON.stringify({
    organizationUrl: 'https://dev.azure.com/test-org%20with%20spaces/'
});
process.env['ENDPOINT_URL_TestAzureDevOpsConnection'] = 'https://dev.azure.com/test-org%20with%20spaces/';

process.env['SYSTEM_COLLECTIONURI'] = 'https://dev.azure.com/test-org%20with%20spaces/';
process.env['SYSTEM_TEAMPROJECT'] = 'Test Project With Spaces';
process.env['SYSTEM_JOBID'] = 'test-job-id';
process.env['SYSTEM_PLANID'] = 'test-plan-id';
process.env['SYSTEM_TEAMPROJECTID'] = 'test-project-id';
process.env['SYSTEM_HOSTTYPE'] = 'build';
process.env['AGENT_TEMPDIRECTORY'] = 'C:\\ado\\temp';
process.env['AGENT_WORKFOLDER'] = 'C:\\ado';

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
            "code": 0,
            "stdout": "{\n  \"name\": \"azure-devops\",\n  \"version\": \"1.0.2\"\n}"
        },
        "az login --service-principal -u \"test-sp-id\" --tenant \"test-tenant-id\" --allow-no-subscriptions --federated-token \"mock-token\" --output none": {
            "code": 0,
            "stdout": "Login successful"
        },
        "az devops configure --defaults organization=\"https://dev.azure.com/test-org%20with%20spaces/\"": {
            "code": 0,
            "stdout": "organization configured with special characters"
        },
        "az devops configure --defaults project=\"Test Project With Spaces\"": {
            "code": 0,
            "stdout": "project configured with spaces"
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

tmr.registerMock('./src/Utility', {
    Utility: {
        throwIfError: () => {},
        checkIfAzurePythonSdkIsInstalled: () => true
    }
});

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