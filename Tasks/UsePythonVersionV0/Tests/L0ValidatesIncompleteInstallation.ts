import * as path from 'path';
import * as fs from 'fs';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

const TEST_GITHUB_TOKEN = 'testtoken';

taskRunner.setInput('versionSpec', '3.12.x');
taskRunner.setInput('disableDownloadFromRegistry', 'false');
taskRunner.setInput('addToPath', 'true');
taskRunner.setInput('architecture', 'x64');
taskRunner.setInput('githubToken', TEST_GITHUB_TOKEN);

// `getVariable` is not supported by `TaskLibAnswers`
process.env['AGENT_TOOLSDIRECTORY'] = '$(Agent.ToolsDirectory)';
process.env['APPDATA'] = 'testappdata';

let pythonWasInstalled = false;
let setupExecuted = false;

// Mock azure-pipelines-tool-lib
taskRunner.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool() {
        if (!pythonWasInstalled) {
            return null;
        }

        return path.join('C', 'tools', 'Python', '3.12.10', 'x64');
    },
    findLocalToolVersions: () => pythonWasInstalled ? ['3.12.10'] : [],
    downloadTool: () => Promise.resolve('C:/downloaded/python.zip'),
    extractZip: () => Promise.resolve('C:/extracted/python'),
    extractTar() {
        throw new Error('This should never be called');
    },
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

// Can't mock process, so have to mock taskutil instead
enum Platform {
    Windows,
    MacOS,
    Linux
}

taskRunner.registerMock('./taskutil', {
    Platform,
    getPlatform() {
        return Platform.Windows;
    }
});

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.exec = function(command, args, options) {
    if (command !== 'powershell' || args !== './setup.ps1') {
        throw new Error(`Invalid command and arguments: ${command} ${args}`);
    }

    if (options.cwd !== 'C:/extracted/python') {
        throw new Error(`Invalid python installer dir path: ${options.cwd}`);
    }

    setupExecuted = true;
    pythonWasInstalled = true;
};

// Mock fs.promises to simulate incomplete installation
const fsMock = {
    ...fs,
    promises: {
        stat: async (filePath: string) => {
            // Simulate python.exe exists
            if (filePath.endsWith('python.exe')) {
                return { isFile: () => true, isDirectory: () => false };
            }
            // Simulate missing Lib directory (incomplete installation)
            if (filePath.endsWith('Lib')) {
                throw new Error('ENOENT: no such file or directory');
            }
            // Simulate missing libs directory (incomplete installation)
            if (filePath.endsWith('libs')) {
                throw new Error('ENOENT: no such file or directory');
            }
            // Simulate missing include directory (incomplete installation)
            if (filePath.endsWith('include')) {
                throw new Error('ENOENT: no such file or directory');
            }
            // Default to file not existing
            throw new Error('ENOENT: no such file or directory');
        },
        readdir: async (dirPath: string) => {
            // This shouldn't be called in our incomplete installation scenario
            return [];
        }
    }
};

taskRunner.registerMock('fs', fsMock);
taskRunner.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

// Test manifest contains stable python 3.12.10, so the task should find it
taskRunner.registerMock('typed-rest-client', {
    RestClient: class {
        get(_url: string) {
            return Promise.resolve({
                result: [
                    {
                        "version": "3.12.10",
                        "stable": true,
                        "release_url": "https://github.com/actions/python-versions/releases/tag/3.12.10-14343898437",
                        "files": [
                            {
                                "filename": "python-3.12.10-win32-x64.zip",
                                "arch": "x64",
                                "platform": "win32",
                                "download_url": "https://github.com/actions/python-versions/releases/download/3.12.10-14343898437/python-3.12.10-win32-x64.zip"
                            }
                        ]
                    }
                ]
            });
        }
    }
});

taskRunner.run();