import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

console.log('=== DEBUG: Starting L0SimpleAzVersionCheck test ===');

let taskPath = path.join(__dirname, '..', 'azureclitask.js');
console.log('=== DEBUG: Task path:', taskPath);

let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Minimal required inputs for Azure RM connection (simpler than Azure DevOps)
tmr.setInput('connectionType', 'azureRM');
tmr.setInput('connectedServiceNameARM', 'TestAzureRMConnection');
tmr.setInput('scriptType', 'bash');
tmr.setInput('scriptLocation', 'inlineScript');
tmr.setInput('inlineScript', 'echo "Hello World"');
tmr.setInput('failOnStandardError', 'false');
tmr.setInput('visibleAzLogin', 'false');
tmr.setInput('useGlobalConfig', 'false');
tmr.setInput('cwd', __dirname);

console.log('=== DEBUG: Inputs set ===');

// Setup endpoint authentication for Azure RM with workload identity federation
process.env['ENDPOINT_AUTH_TestAzureRMConnection'] = JSON.stringify({
    scheme: 'WorkloadIdentityFederation',
    parameters: {
        serviceprincipalid: 'test-sp-id',
        tenantid: 'test-tenant-id'
    }
});
process.env['ENDPOINT_AUTH_SCHEME_TestAzureRMConnection'] = 'WorkloadIdentityFederation';
process.env['ENDPOINT_AUTH_PARAMETER_TestAzureRMConnection_SERVICEPRINCIPALID'] = 'test-sp-id';
process.env['ENDPOINT_AUTH_PARAMETER_TestAzureRMConnection_TENANTID'] = 'test-tenant-id';
process.env['ENDPOINT_DATA_TestAzureRMConnection_SUBSCRIPTIONID'] = 'test-subscription-id';

// System variables
process.env['SYSTEM_COLLECTIONURI'] = 'https://dev.azure.com/testorg/';
process.env['SYSTEM_TEAMPROJECT'] = 'TestProject';
process.env['SYSTEM_JOBID'] = 'test-job-id';
process.env['SYSTEM_PLANID'] = 'test-plan-id';
process.env['SYSTEM_TEAMPROJECTID'] = 'test-project-id';
process.env['SYSTEM_HOSTTYPE'] = 'build';
process.env['AGENT_TEMPDIRECTORY'] = __dirname;
process.env['AGENT_WORKFOLDER'] = __dirname;

// Disable feature flags
process.env['AZP_AZURECLIV2_SETUP_PROXY_ENV'] = 'false';
process.env['ShowWarningOnOlderAzureModules'] = 'false';
process.env['UseAzVersion'] = 'false';

console.log('=== DEBUG: Environment variables set ===');

let mockAnswers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "az": "az",
        "bash": "bash"
    },
    "checkPath": {
        "az": true,
        "bash": true
    },
    "execSync": {
        // Support both version commands - CI uses 'az version', local may use 'az --version'
        "az version": {
            "code": 0,
            "stdout": "{\"azure-cli\": \"2.50.0\", \"azure-cli-core\": \"2.50.0\"}"
        },
        "az --version": {
            "code": 0,
            "stdout": "azure-cli                         2.50.0\ncore                              2.50.0\ntelemetry                          1.0.8"
        },
        "az account clear": {
            "code": 0,
            "stdout": "Logged out"
        },
        "az login --service-principal -u \"test-sp-id\" --tenant \"test-tenant-id\" --allow-no-subscriptions --federated-token \"mock-oidc-token\" --output none": {
            "code": 0,
            "stdout": "Login successful"
        },
        "az account set --subscription \"test-subscription-id\"": {
            "code": 0,
            "stdout": "Subscription set"
        }
    },
    "exec": {
        // Support both version commands - CI uses 'az version', local may use 'az --version'
        "az version": {
            "code": 0,
            "stdout": "{\"azure-cli\": \"2.50.0\", \"azure-cli-core\": \"2.50.0\"}"
        },
        "az --version": {
            "code": 0,
            "stdout": "azure-cli                         2.50.0\ncore                              2.50.0\ntelemetry                          1.0.8"
        },
        "az login --service-principal -u \"test-sp-id\" --tenant \"test-tenant-id\" --allow-no-subscriptions --federated-token \"mock-oidc-token\" --output none": {
            "code": 0,
            "stdout": "Login successful"
        },
        "az account set --subscription \"test-subscription-id\"": {
            "code": 0,
            "stdout": "Subscription set"
        },
        "az account clear": {
            "code": 0,
            "stdout": "Logged out"
        }
    },
    "exist": {
        "bash": true
    }
};

console.log('=== DEBUG: Mock answers defined ===');

tmr.setAnswers(mockAnswers);

// Mock azure-devops-node-api for OIDC token retrieval
tmr.registerMock('azure-devops-node-api', {
    getHandlerFromToken: function(token: string) {
        console.log('=== DEBUG: getHandlerFromToken called ===');
        return {};
    },
    WebApi: function(uri: string, handler: any, options?: any) {
        console.log('=== DEBUG: WebApi constructor called with uri:', uri);
        return {
            getTaskApi: function() {
                console.log('=== DEBUG: getTaskApi called ===');
                return Promise.resolve({
                    createOidcToken: function() {
                        console.log('=== DEBUG: createOidcToken called ===');
                        return Promise.resolve({ oidcToken: 'mock-oidc-token' });
                    }
                });
            }
        };
    }
});

// Mock artifacts-common webapi
tmr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', {
    getSystemAccessToken: function() {
        console.log('=== DEBUG: getSystemAccessToken called ===');
        return 'mock-system-token';
    }
});

// Mock azure-arm-rest azCliUtility
tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azCliUtility', {
    validateAzModuleVersion: function(moduleName: string, stdout: string, displayName: string, tolerance: number) {
        console.log('=== DEBUG: validateAzModuleVersion called ===');
        console.log('=== DEBUG: moduleName:', moduleName, 'displayName:', displayName);
        return Promise.resolve();
    }
});

// Mock the Utility module
tmr.registerMock('./src/Utility', {
    Utility: {
        checkIfAzurePythonSdkIsInstalled: function() {
            console.log('=== DEBUG: checkIfAzurePythonSdkIsInstalled called ===');
            return true;
        },
        throwIfError: function(result: any, errormsg?: string) {
            console.log('=== DEBUG: throwIfError called, code:', result?.code);
            if (result && result.code !== 0) {
                throw new Error(errormsg || 'Command failed');
            }
        },
        getScriptPath: function(scriptLocation: string, fileExtensions: string[]) {
            console.log('=== DEBUG: getScriptPath called ===');
            return Promise.resolve(path.join(__dirname, 'test-script.sh'));
        },
        createFile: function(filePath: string, data: string, options?: any) {
            console.log('=== DEBUG: createFile called ===');
            return Promise.resolve();
        },
        deleteFile: function(filePath: string) {
            console.log('=== DEBUG: deleteFile called ===');
            return Promise.resolve();
        }
    }
});

// Mock the ScriptType module
tmr.registerMock('./src/ScriptType', {
    ScriptTypeFactory: {
        getScriptType: function() {
            console.log('=== DEBUG: getScriptType called ===');
            return {
                getTool: function() {
                    console.log('=== DEBUG: getTool called ===');
                    return Promise.resolve({
                        on: function(event: string, callback: Function) {
                            console.log('=== DEBUG: tool.on called for event:', event);
                        },
                        line: function(args: string) {
                            return this;
                        },
                        arg: function(args: string) {
                            return this;
                        },
                        exec: function(options?: any) {
                            console.log('=== DEBUG: tool.exec called (script execution) ===');
                            return Promise.resolve(0);
                        }
                    });
                },
                cleanUp: function() {
                    console.log('=== DEBUG: cleanUp called ===');
                    return Promise.resolve();
                }
            };
        }
    }
});

console.log('=== DEBUG: All mocks registered, running task ===');

tmr.run();
