import * as path from 'path';

import { TaskMockRunner } from 'vsts-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('versionSpec', '7.3');
taskRunner.setInput('architecture', 'x64');

// Mock vsts-task-tool-lib
taskRunner.registerMock('vsts-task-tool-lib/tool', {
    findLocalTool: () => null,
    findLocalToolVersions: () => ['5.6.0', '7.1.0']
});

taskRunner.run();
