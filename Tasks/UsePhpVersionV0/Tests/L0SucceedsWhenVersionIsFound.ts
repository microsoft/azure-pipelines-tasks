import * as path from 'path';

import { TaskMockRunner } from 'vsts-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('versionSpec', '7.x');
taskRunner.setInput('architecture', 'x64');

// Mock vsts-task-tool-lib
const toolPath = path.join('/', 'Php', '7.0.0', 'x64');
taskRunner.registerMock('vsts-task-tool-lib/tool', {
    findLocalTool: () => toolPath
});

taskRunner.run();
