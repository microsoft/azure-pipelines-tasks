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

// Enable UseAzVersion feature flag
process.env['DISTRIBUTEDTASK_TASKS_USEAZVERSION'] = 'true';
process.env['DISTRIBUTEDTASK_TASKS_ENABLELATEBOUNDIDTOKEN'] = 'false';

// Mock Endpoint
process.env['ENDPOINT_URL_AzureRM'] = 'https://management.azure.com/';
process.env['ENDPOINT_AUTH_AzureRM'] = '{"parameters":{"serviceprincipalid":"spId","serviceprincipalkey":"spKey","tenantid":"tenantId"},"scheme":"ServicePrincipal"}';
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ServicePrincipal';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID'] = 'spId';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY'] = 'spKey';
process.env['ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID'] = 'tenantId';
process.env['ENDPOINT_DATA_AzureRM'] = '{"environment":"AzureCloud","SubscriptionID":"sub1"}';
process.env['ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID'] = 'sub1';

// Mock Telemetry
tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: (area, feature, data) => {
        console.log(`MOCK_TELEMETRY: ${area}, ${feature}, ${JSON.stringify(data)}`);
    }
});

// Mock Utility
tmr.registerMock('./src/Utility', {
    Utility: {
        checkIfAzurePythonSdkIsInstalled: () => true,
        throwIfError: () => {}
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

// YAML format output from `az version --output yaml`
const azVersionYamlOutput = 'azure-cli: 2.85.0\nazure-cli-core: 2.85.0\nazure-cli-telemetry: 1.1.0';

// Answers — az version returns YAML format
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
            "stdout": azVersionYamlOutput
        },
        "az --version": {
            "code": 0,
            "stdout": azVersionYamlOutput
        },
        "az account clear": {
            "code": 0
        },
        "az login --service-principal -u \"spId\" --password=\"spKey\" --tenant \"tenantId\"": {
            "code": 0
        },
        "az login --service-principal -u \"spId\" --password=\"spKey\" --tenant \"tenantId\" --allow-no-subscriptions": {
            "code": 0
        },
        "az account set --subscription \"sub1\"": {
            "code": 0
        }
    }
};
tmr.setAnswers(a);

tmr.run();
