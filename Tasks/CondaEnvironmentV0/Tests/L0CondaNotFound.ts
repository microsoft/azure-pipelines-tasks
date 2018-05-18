import * as path from 'path';

import * as sinon from 'sinon';

import { TaskMockRunner } from 'vsts-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('environmentName', 'test');

// Mock vsts-task-lib
taskRunner.setAnswers({
    which: {
    }
});

const getVariable = sinon.stub();
getVariable.withArgs('CONDA').returns(undefined);

taskRunner.registerMock('vsts-task-lib/task', {
    // `getVariable` is not supported by `TaskLibAnswers`
    getVariable: getVariable
});

// Mock vsts-task-tool-lib
taskRunner.registerMock('vsts-task-tool-lib/tool', {
    prependPath: () => undefined
});

taskRunner.run();