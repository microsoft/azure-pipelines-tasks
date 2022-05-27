import * as path from 'path';
import * as fs from 'fs';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

const TEST_GITHUB_TOKEN = 'testtoken';

taskRunner.setInput('versionSpec', '3.11.x');
taskRunner.setInput('disableDownloadFromRegistry', 'false');
taskRunner.setInput('addToPath', 'false');
taskRunner.setInput('architecture', 'x64');
taskRunner.setInput('githubToken', TEST_GITHUB_TOKEN);

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

// There is unstable python 3.11.x in the test manifest, but it should not be picked up since we didn't allow unstable versions
// Test manifest only contains stable python 3.10
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
