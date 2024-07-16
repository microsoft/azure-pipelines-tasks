import * as path from 'path';

import * as libMocker from 'azure-pipelines-task-lib/lib-mocker';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('environmentName', 'test');

// Mock azure-pipelines-task-lib
taskRunner.setAnswers({
    which: {
        // 'conda': path.join('/', 'miniconda', 'bin', 'conda')
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

// Mock azure-pipelines-tool-lib
taskRunner.registerMock('azure-pipelines-tool-lib/tool', {
    prependPath: () => undefined,
});

// Mock other dependencies
const fsObj = require('fs');
libMocker.registerMock('fs', Object.assign({}, fsObj, { existsSync: () => false }));

taskRunner.run();