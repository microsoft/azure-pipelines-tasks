import * as path from 'path';

import { TaskMockRunner } from 'vsts-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('versionSpec', 'Anaconda');
taskRunner.setInput('addToPath', 'true');
taskRunner.setInput('architecture', 'x64');

// Mock vsts-task-tool-lib
const toolPath = path.join('/', 'usr', 'miniconda');
taskRunner.registerMock('vsts-task-tool-lib/tool', {
    findLocalTool: () => toolPath
});

taskRunner.registerMock('./toolutil', {
    prependPathSafe: (toolPath: string) => {
        console.log('##vso[task.prependpath]' + toolPath);
    }
});

// `getVariable` is not supported by `TaskLibAnswers`
process.env['CONDA'] = '/miniconda';

taskRunner.run();
