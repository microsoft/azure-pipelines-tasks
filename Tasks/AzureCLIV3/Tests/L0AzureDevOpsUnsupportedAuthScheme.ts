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
    scheme: 'ServicePrincipal',
    parameters: {
        serviceprincipalid: 'test-sp-id',
        serviceprincipalkey: 'test-sp-key',
        tenantid: 'test-tenant-id'
    }
});
process.env['ENDPOINT_AUTH_SCHEME_TestAzureDevOpsConnection'] = 'ServicePrincipal';
process.env['ENDPOINT_AUTH_PARAMETER_TestAzureDevOpsConnection_SERVICEPRINCIPALID'] = 'test-sp-id';
process.env['ENDPOINT_AUTH_PARAMETER_TestAzureDevOpsConnection_SERVICEPRINCIPALKEY'] = 'test-sp-key';
process.env['ENDPOINT_AUTH_PARAMETER_TestAzureDevOpsConnection_TENANTID'] = 'test-tenant-id';

process.env['ENDPOINT_DATA_TestAzureDevOpsConnection'] = JSON.stringify({
    organizationUrl: 'https://dev.azure.com/testorg/'
});
process.env['ENDPOINT_URL_TestAzureDevOpsConnection'] = 'https://dev.azure.com/testorg/';

process.env['SYSTEM_COLLECTIONURI'] = 'https://dev.azure.com/testorg/';
process.env['SYSTEM_TEAMPROJECT'] = 'TestProject';
process.env['SYSTEM_TEAMPROJECTID'] = 'test-project-id';
process.env['AGENT_TEMPDIRECTORY'] = __dirname;
process.env['AGENT_WORKFOLDER'] = __dirname;

process.env['AZP_AZURECLIV2_SETUP_PROXY_ENV'] = 'false';
process.env['ShowWarningOnOlderAzureModules'] = 'false';
process.env['UseAzVersion'] = 'false';

let mockAnswers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "az": "/usr/bin/az",
        "bash": "/bin/bash"
    },
    "checkPath": {
        "/usr/bin/az": true,
        "/bin/bash": true
    },
    "exec": {
        "/usr/bin/az --version": {
            "code": 0,
            "stdout": "azure-cli 2.50.0\n"
        },
        "/usr/bin/az extension add -n azure-devops -y": {
            "code": 0,
            "stdout": "Azure DevOps CLI extension installed\n"
        }
    }
};

tmr.setAnswers(mockAnswers);

tmr.run();
