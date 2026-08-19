import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'azureclitask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Inputs
tmr.setInput('connectedServiceNameARM', 'AzureRM');
tmr.setInput('scriptType', 'bash');
tmr.setInput('scriptLocation', 'inlineScript');
tmr.setInput('inlineScript', 'echo error >&2');
tmr.setInput('cwd', '/tmp');
tmr.setInput('visibleAzLogin', 'true');
tmr.setInput('failOnStandardError', 'true'); // Enable fail on stderr

// Environment variables
process.env['DISTRIBUTEDTASK_TASKS_ENABLELATEBOUNDIDTOKEN'] = 'false';
process.env['DISTRIBUTEDTASK_TASKS_USEAZVERSION'] = 'false';

// Mock Endpoint
process.env['ENDPOINT_URL_AzureRM'] = 'https://management.azure.com/';
process.env['ENDPOINT_AUTH_AzureRM'] = '{"parameters":{"serviceprincipalid":"spId","serviceprincipalkey":"spKey","tenantid":"tenantId"},"scheme":"ServicePrincipal"}';
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ServicePrincipal';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY'] = 'spKey';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID'] = 'tenantId';
process.env['ENDPOINT_DATA_AzureRM'] = '{"environment":"AzureCloud"}';

// Mock Telemetry
tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: () => {}
});

// Mock WebApi
tmr.registerMock('azure-devops-node-api', {
    getHandlerFromToken: () => {},
    WebApi: class {
        getTaskApi() { return Promise.resolve({}); }
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
                        exec: () => Promise.resolve(0),
                        on: (event: string, callback: any) => {
                            // Simulate stderr output
                            if (event === 'errline') {
                                callback('error message 1');
                                callback('error message 2');
                            }
                        }
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
        "az": "az"
    },
    "checkPath": {
        "az": true
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
        "az login --service-principal -u \"spId\" --password=\"spKey\" --tenant \"tenantId\" --allow-no-subscriptions": {
            "code": 0
        }
    }
};

tmr.setAnswers(a);
tmr.run();
