import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';

const taskPath = path.join(__dirname, '..', 'azurecontainerapps.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set required arguments for the test
tmr.setInput('cwd', '/fakecwd');
tmr.setInput('appSourcePath', '/samplepath');
tmr.setInput('imageToDeploy', 'imagetodeploy');

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

// Run the mocked task test
tmr.run();