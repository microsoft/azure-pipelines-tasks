import * as path from 'path';

import * as mockery from 'mockery';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('createCustomEnvironment', 'true');
taskRunner.setInput('environmentName', 'test');

// `getVariable` is not supported by `TaskLibAnswers`
process.env['HOME'] = '/home';
process.env['USERPROFILE'] = '\\userprofile'

// Mock azure-pipelines-task-lib
taskRunner.setAnswers({
    which: {
        'conda': '/miniconda/bin/conda'
    },
    exec: {
        'conda create --quiet --prefix /home/.conda/envs/test --mkdir --yes': {
            code: 0
        },
        'conda create --quiet --prefix \\userprofile\\.conda\\envs\\test --mkdir --yes': {
            code: 0
        },
    }
});

// Mock azure-pipelines-tool-lib
taskRunner.registerMock('azure-pipelines-tool-lib/tool', {
    prependPath: () => undefined,
});

// Mock other dependencies
mockery.registerMock('fs', {
    existsSync: () => false
});

taskRunner.run();