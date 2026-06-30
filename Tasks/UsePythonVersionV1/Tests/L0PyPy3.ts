import * as path from 'path';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('versionSpec', 'pypy3');
taskRunner.setInput('addToPath', 'true');
taskRunner.setInput('architecture', 'x64');

// Mock azure-pipelines-tool-lib
const toolPath = path.join('/', 'PyPy', '3.5.2', 'x64');
taskRunner.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: () => toolPath
});

taskRunner.registerMock('./toolutil', {
    prependPathSafe: (toolPath: string) => {
        console.log('##vso[task.prependpath]' + toolPath);
    }
});

taskRunner.run();
