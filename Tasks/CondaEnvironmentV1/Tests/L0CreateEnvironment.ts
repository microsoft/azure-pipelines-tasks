import * as path from 'path';

import * as mockery from 'mockery';

import { TaskMockRunner } from 'vsts-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('createCustomEnvironment', 'true');
taskRunner.setInput('environmentName', 'test');

// Mock vsts-task-lib
taskRunner.setAnswers({
    which: {
        'conda': '/miniconda/bin/conda'
    },
    exec: {
        'conda create --quiet --prefix /miniconda/envs/test --mkdir --yes': {
            'code': 0
        },
        'conda create --quiet --prefix \\miniconda\\envs\\test --mkdir --yes': {
            'code': 0
        },
    }
});

// Mock vsts-task-tool-lib
taskRunner.registerMock('vsts-task-tool-lib/tool', {
    prependPath: () => undefined,
});

// Mock other dependencies
mockery.registerMock('fs', {
    existsSync: () => false
});

taskRunner.run();