import * as path from 'path';
import * as fs from 'fs';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

const TEST_GITHUB_TOKEN = 'testtoken';

taskRunner.setInput('versionSpec', '3.10.x');
taskRunner.setInput('disableDownloadFromRegistry', 'false');
taskRunner.setInput('addToPath', 'true');
taskRunner.setInput('architecture', 'x64');
taskRunner.setInput('githubToken', TEST_GITHUB_TOKEN);

// `getVariable` is not supported by `TaskLibAnswers`
process.env['AGENT_TOOLSDIRECTORY'] = '$(Agent.ToolsDirectory)';

let pythonWasInstalled = false;

// Mock azure-pipelines-tool-lib
taskRunner.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool() {
        if (!pythonWasInstalled) {
            return null;
        }

        return path.join('opt', 'hostedtoolcache', 'Python', '3.10.1', 'x64');
    },
    findLocalToolVersions: () => ['2.6.0', '2.7.13'],
    downloadTool: () => Promise.resolve('/home/python.tar.gz'),
    extractTar: () => Promise.resolve('/home/extracted/python'),
    extractZip() {
        throw new Error('This should never be called');
    },
});

taskRunner.registerMock('os', {
    platform() {
        return 'linux';
    },
    arch() {
        return 'x64';
    },
    EOL: '\r\n'
});

// Can't mock process, so have to mock taskutil instead
enum Platform {
    Windows,
    MacOS,
    Linux
}

taskRunner.registerMock('./taskutil', {
    Platform,
    getPlatform() {
        return Platform.Linux;
    }
});

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.exec = function(command, args, options) {
    if (command !== 'bash' || args !== './setup.sh') {
        throw new Error(`Invalid command and arguments: ${command} ${args}`);
    }

    if (options.cwd !== '/home/extracted/python') {
        throw new Error(`Invalid python installer dir path: ${options.cwd}`);
    }

    pythonWasInstalled = true;
};
taskRunner.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

// Test manifest contains stable python 3.10.1, so the task should find it
taskRunner.registerMock('typed-rest-client', {
    RestClient: class {
        get(_url: string) {
            return Promise.resolve({
                result: JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'versions-manifest.json')).toString())
            });
        }
    }
});

const lsbPath = '/etc/lsb-release';
taskRunner.registerMock('fs', {
    existsSync(filePath) {
        if (filePath !== lsbPath) {
            throw new Error(`Tried to check the wrong file for existance: ${filePath}`);
        }

        return true;
    },

    readFileSync(filePath) {
        if (filePath !== lsbPath) {
            throw new Error(`Tried to read the wrong file: ${filePath}`);
        }

        return 'DISTRIB_RELEASE=18.04';
    }
});

taskRunner.run();
