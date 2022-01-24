import * as path from 'path';
import * as fs from 'fs';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('versionSpec', '3.6.x');
taskRunner.setInput('addToPath', 'false');
taskRunner.setInput('architecture', 'x64');

// `getVariable` is not supported by `TaskLibAnswers`
process.env['AGENT_TOOLSDIRECTORY'] = '$(Agent.ToolsDirectory)';

// Mock azure-pipelines-tool-lib
taskRunner.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: () => null,
    findLocalToolVersions: () => ['2.6.0', '2.7.13']
});

taskRunner.registerMock('os', {
    platform() {
        return 'win32';
    },
    arch() {
        return 'x64';
    },
    EOL: '\r\n'
});

// Test manifest only contains python 3.10, so the task should not find it
taskRunner.registerMock('typed-rest-client', {
    RestClient: class {
        get(_url: string) {
            return Promise.resolve({
                result: JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'versions-manifest.json')).toString())
            });
        }
    }
});

taskRunner.run();
