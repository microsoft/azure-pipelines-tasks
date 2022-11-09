import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';

const taskPath = path.join(__dirname, '..', 'azurecontainerapps.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set required arguments for the test
tmr.setInput('cwd', '/fakecwd');
tmr.setInput('appSourcePath', '/samplepath');
tmr.setInput('connectedServiceNameARM', 'test-connectedServiceNameARM');

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

// Mock out function calls for the Utility class
tmr.registerMock('./src/Utility', {
    Utility: function() {
        return {
            setAzureCliDynamicInstall: function() {
                return;
            }
        };
    }
});

// Mock out function calls for the ContainerAppHelper class
tmr.registerMock('./src/ContainerAppHelper', {
    ContainerAppHelper: function() {
        return {
            installPackCliAsync: async function() {
                return;
            }
        };
    }
});

// Mock out function calls for the AzureAuthenticationHelper class
tmr.registerMock('./src/AzureAuthenticationHelper', {
    AzureAuthenticationHelper: function() {
        return {
            loginAzureRM: function() {
                return;
            },
            logoutAzure: function() {
                return;
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