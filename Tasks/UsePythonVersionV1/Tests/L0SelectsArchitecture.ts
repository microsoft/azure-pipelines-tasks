import * as path from 'path';

import * as sinon from 'sinon';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('versionSpec', '3.x');
taskRunner.setInput('addToPath', 'false');
taskRunner.setInput('architecture', 'x86');

// Mock azure-pipelines-tool-lib
const findLocalTool = sinon.stub();
findLocalTool.withArgs(sinon.match.any, sinon.match.any, 'x86').returns('x86ToolPath');
findLocalTool.withArgs(sinon.match.any, sinon.match.any, 'x64').returns('x64ToolPath');
taskRunner.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: findLocalTool
});

taskRunner.run();
