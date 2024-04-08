import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';

const taskPath = path.join(__dirname, '..', 'azurecontainerapps.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set required arguments for the test
tmr.setInput('cwd', '/fakecwd');
tmr.setInput('imageToDeploy', 'imageToDeploy');
tmr.setInput('disableTelemetry', 'true');

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);

// Assign dummy values for build variables
tlClone.getVariable = function(variable: string) {
    if (variable.toLowerCase() === 'build.buildid') {
        return 'test-build-id';
    } else if (variable.toLowerCase() === 'build.buildnumber') {
        return 'test-build-number';
    }
    return null;
};
tlClone.assertAgent = function(variable: string) {
    return;
};
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

/**
 * ----------------------------------
 * Mock out the common helper classes
 * ----------------------------------
 */

// Mock out function calls for the AzureAuthenticationHelper class
tmr.registerMock('./src/AzureAuthenticationHelper', {
    AzureAuthenticationHelper: function() {
        return {
            loginAzure: function() {
                console.log('[MOCK] loginAzure called');
                return;
            },
            logoutAzure: function() {
                console.log('[MOCK] logoutAzure called');
                return;
            }
        };
    }
});

// Mock out function calls for the ContainerRegistryHelper class
tmr.registerMock('./src/ContainerRegistryHelper', {
    ContainerRegistryHelper: function() {
        return {
            loginAcrWithUsernamePassword: function(acrName: string, acrUsername: string, acrPassword: string) {
                console.log('[MOCK] loginAcrWithUsernamePassword called');
                return;
            },
            loginAcrWithAccessTokenAsync: async function() {
                console.log('[MOCK] loginAcrWithAccessTokenAsync called');
                return;
            },
            pushImageToAcr: function() {
                console.log('[MOCK] pushImageToAcr called');
                return;
            }
        };
    }
});

// Mock out function calls for the TelemetryHelper class
tmr.registerMock('./src/TelemetryHelper', {
    TelemetryHelper: function() {
        return {
            setSuccessfulResult: function() {
                console.log('[MOCK] setSuccessfulResult called');
                return;
            },
            setFailedResult: function(errorMessage: string) {
                console.log('[MOCK] setFailedResult called');
                return;
            },
            setBuilderScenario: function() {
                console.log('[MOCK] setBuilderScenario called');
                return;
            },
            setDockerfileScenario: function() {
                console.log('[MOCK] setDockerfileScenario called');
                return;
            },
            setImageScenario: function() {
                console.log('[MOCK] setImageScenario called');
                return;
            },
            sendLogs: function() {
                console.log('[MOCK] sendLogs called');
                return;
            }
        };
    }
});

// Mock out function calls for the Utility class
tmr.registerMock('./src/Utility', {
    Utility: function() {
        return {
            setAzureCliDynamicInstall: function() {
                console.log('[MOCK] setAzureCliDynamicInstall called');
                return;
            },
            isNullOrEmpty(str: string): boolean {
                return str === null || str === undefined || str === "";
            }
        };
    }
});

// Mock out command calls
const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': {
        'bash': 'path/to/bash'
    },
    'checkPath': {
        'path/to/bash': true,
        '/fakecwd': true
    },
    'path/to/bash': {
        '*': {
            'code': 0
        }
    }
};
tmr.setAnswers(a);

// Run the mocked task test
tmr.run();