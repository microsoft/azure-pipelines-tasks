import * as path from 'path';

import * as sinon from 'sinon';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('versionSpec', '3.x');
taskRunner.setInput('addToPath', 'false');
taskRunner.setInput('architecture', 'x64-freethreaded');

const findLocalTool = sinon.stub();
findLocalTool.withArgs(sinon.match.any, sinon.match.any, 'x64-freethreaded').returns('x64FreeThreadedToolPath');
taskRunner.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool
});

taskRunner.run();
