import * as path from 'path';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('environmentName', 'test');

// Mock azure-pipelines-task-lib
taskRunner.setAnswers({
    which: {
    }
});

// `getVariable` is not supported by `TaskLibAnswers`
process.env['CONDA'] = undefined;

// Mock azure-pipelines-tool-lib
taskRunner.registerMock('azure-pipelines-tool-lib/tool', {
    prependPath: () => undefined
});

taskRunner.run();