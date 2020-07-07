import * as path from 'path';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('packageSpecs', 'python=3');
taskRunner.setInput('installOptions', '--json');

// Mock azure-pipelines-task-lib
taskRunner.setAnswers({
    which: {
        'conda': '/miniconda/bin/conda'
    },
    exec: {
        'sudo /miniconda/bin/conda install python=3 --quiet --yes --json': {
            code: 0
        },
        'conda install python=3 --quiet --yes --json': {
            code: 0
        },
        '/miniconda/bin/conda info --base': {
            code: 0,
            stdout: '/base/environment'
        },
    },
    checkPath: {
        '/miniconda/bin/conda': true
    }
});

// Mock azure-pipelines-tool-lib
taskRunner.registerMock('azure-pipelines-tool-lib/tool', {
    prependPath: () => undefined,
});

taskRunner.run();