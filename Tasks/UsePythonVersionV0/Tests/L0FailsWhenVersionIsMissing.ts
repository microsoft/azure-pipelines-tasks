import * as path from 'path';

import { TaskMockRunner } from 'vsts-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('versionSpec', '3.x');
taskRunner.setInput('addToPath', 'false');
taskRunner.setInput('architecture', 'x64');

// Mock vsts-task-tool-lib
taskRunner.registerMock('vsts-task-tool-lib/tool', {
    findLocalTool: () => null,
    findLocalToolVersions: () => ['2.6.0', '2.7.13']
});

taskRunner.run();
