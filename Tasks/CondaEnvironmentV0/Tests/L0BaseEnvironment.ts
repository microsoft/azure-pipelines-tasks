import * as path from 'path';

import * as mockery from 'mockery';

import { TaskMockRunner } from 'vsts-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('packageSpecs', 'python=3');
taskRunner.setInput('installOptions', '--json');

// Mock vsts-task-lib
taskRunner.setAnswers({
    which: {
        'conda': '/miniconda/bin/conda'
    },
    exec: {
        'conda install python=3 --quiet --yes --json': {
            'code': 0
        }
    }
});

// Mock vsts-task-tool-lib
taskRunner.registerMock('vsts-task-tool-lib/tool', {
    prependPath: () => undefined,
});

taskRunner.run();