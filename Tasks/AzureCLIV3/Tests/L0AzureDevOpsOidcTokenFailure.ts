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
process.env['SYSTEM_JOBID'] = 'job-123';
process.env['SYSTEM_PLANID'] = 'plan-456';
process.env['SYSTEM_TEAMPROJECTID'] = 'project-789';
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
        "az version": {
            "code": 0,
            "stdout": "{\"azure-cli\": \"2.50.0\", \"azure-cli-core\": \"2.50.0\"}"
        },
        "az extension show --name azure-devops": {
            "code": 1,
            "stdout": "Extension not found"
        },
        "az extension add -n azure-devops -y": {
            "code": 0,
            "stdout": "Azure DevOps CLI extension installed"
        }
    },
    "exists": {
        "bash": true
    }
};

tmr.setAnswers(mockAnswers);

// Mock to simulate OIDC token retrieval failure
tmr.registerMock('azure-devops-node-api', {
    getHandlerFromToken: () => ({}),
    WebApi: function() {
        return {
            getTaskApi: () => Promise.resolve({
                createOidcToken: () => Promise.reject(new Error('Failed to retrieve OIDC token'))
            })
        };
    }
});

tmr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', {
    getSystemAccessToken: () => 'system-token'
});

tmr.registerMock('./src/Utility', {
    Utility: {
        checkIfAzurePythonSdkIsInstalled: function() {
            return true;
        },
        throwIfError: function(result: any, errormsg?: string) {
            if (result && result.code !== 0) {
                throw new Error(errormsg || 'Command failed');
            }
        },
        getScriptPath: function(scriptLocation: string, fileExtensions: string[]) {
            return Promise.resolve(path.join(__dirname, 'test-script.sh'));
        },
        getPowerShellScriptPath: function(scriptLocation: string, fileExtensions: string[], scriptArguments: string) {
            return Promise.resolve(path.join(__dirname, 'test-script.ps1'));
        },
        createFile: function(filePath: string, data: string, options?: any) {
            return Promise.resolve();
        },
        deleteFile: function(filePath: string) {
            return Promise.resolve();
        }
    }
});

// Mock the ScriptType module
tmr.registerMock('./src/ScriptType', {
    ScriptTypeFactory: {
        getScriptType: function() {
            return {
                getTool: function() {
                    return Promise.resolve({
                        on: function(event: string, callback: Function) {
                            // No-op for event handlers
                        },
                        line: function(args: string) {
                            // No-op for argument line
                        },
                        arg: function(args: string) {
                            // No-op for arguments
                            return this;
                        },
                        exec: function(options?: any) {
                            console.log('Mock script execution completed');
                            return Promise.resolve(0);
                        }
                    });
                },
                cleanUp: function() {
                    return Promise.resolve();
                }
            };
        }
    }
});

tmr.run();