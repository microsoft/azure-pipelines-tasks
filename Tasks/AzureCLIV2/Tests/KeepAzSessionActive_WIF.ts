import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'azureclitask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Inputs
tmr.setInput('connectedServiceNameARM', 'AzureRM');
tmr.setInput('scriptType', 'bash');
tmr.setInput('scriptLocation', 'inlineScript');
tmr.setInput('inlineScript', 'echo hello');
tmr.setInput('cwd', '/tmp');
tmr.setInput('visibleAzLogin', 'true');
tmr.setInput('keepAzSessionActive', 'true'); // Enable session refresh
tmr.setInput('addSpnToEnvironment', 'true');

// Environment variables
process.env['DISTRIBUTEDTASK_TASKS_ENABLELATEBOUNDIDTOKEN'] = 'false';
process.env['DISTRIBUTEDTASK_TASKS_USEAZVERSION'] = 'false';
process.env['System.TeamProjectId'] = 'projectId';
process.env['System.PlanId'] = 'planId';
process.env['System.JobId'] = 'jobId';
process.env['System.HostType'] = 'build';
process.env['System.CollectionUri'] = 'https://dev.azure.com/org/';

// Mock Endpoint with Workload Identity Federation
process.env['ENDPOINT_URL_AzureRM'] = 'https://management.azure.com/';
process.env['ENDPOINT_AUTH_AzureRM'] = '{"parameters":{"serviceprincipalid":"spId","tenantid":"tenantId"},"scheme":"WorkloadIdentityFederation"}';
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'WorkloadIdentityFederation';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID'] = 'tenantId';
process.env['ENDPOINT_DATA_AzureRM'] = '{"environment":"AzureCloud"}';
process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = '{"parameters":{"AccessToken":"token"},"scheme":"OAuth"}';
process.env['ENDPOINT_AUTH_SCHEME_SYSTEMVSSCONNECTION'] = 'OAuth';
process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = 'token';

let refreshCallCount = 0;

// Mock Telemetry
tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: () => {}
});

// Mock Artifacts Common for getSystemAccessToken
tmr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', {
    getSystemAccessToken: () => 'token'
});

// Mock WebApi
tmr.registerMock('azure-devops-node-api', {
    getHandlerFromToken: () => {},
    WebApi: class {
        getTaskApi() {
            return Promise.resolve({
                createOidcToken: () => {
                    console.log("MOCK_CREATE_OIDC_TOKEN_CALLED");
                    return Promise.resolve({ oidcToken: "oidcTokenFromApi" });
                }
            });
        }
    }
});

// Mock Utility
tmr.registerMock('./src/Utility', {
    Utility: {
        checkIfAzurePythonSdkIsInstalled: () => true,
        throwIfError: (code: any) => {
            if (code && code.code !== 0) {
                throw code;
            }
        }
    }
});

// Mock ScriptType
tmr.registerMock('./src/ScriptType', {
    ScriptTypeFactory: {
        getSriptType: () => {
            return {
                getTool: () => {
                    return {
                        exec: (options: any) => {
                            // Verify that idToken is passed when using WIF
                            if (options.env && options.env.idToken) {
                                console.log('IDTOKEN_ENV_VARIABLE_PRESENT');
                            }
                            return Promise.resolve(0);
                        },
                        on: () => {}
                    };
                },
                cleanUp: () => Promise.resolve()
            };
        }
    }
});

// Mock azCliUtility
tmr.registerMock('azure-pipelines-tasks-azure-arm-rest/azCliUtility', {
    validateAzModuleVersion: () => Promise.resolve()
});

// Mock toolrunner
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

// Answers
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "az": "az",
        "bash": "/bin/bash"
    },
    "checkPath": {
        "az": true,
        "/bin/bash": true
    },
    "exec": {
        "az version": {
            "code": 0,
            "stdout": "azure-cli 2.66.0"
        },
        "az --version": {
            "code": 0,
            "stdout": "azure-cli 2.66.0"
        },
        "az account clear": {
            "code": 0
        },
        "az login --service-principal -u \"spId\" --tenant \"tenantId\" --allow-no-subscriptions --federated-token \"oidcTokenFromApi\"": {
            "code": 0
        }
    },
    "rmRF": {
        "*": {
            "success": true
        }
    }
};

tmr.setAnswers(a);
tmr.run();
