import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tmr.setInput('version', '1.21.3');

// Mock environment variables
process.env['Agent.TempDirectory'] = path.join(__dirname, 'temp');

// Mock different platforms to test filename generation
let testPlatforms = [
    { platform: 'win32', arch: 'x64', expected: 'go1.21.3.windows-amd64.zip' },
    { platform: 'linux', arch: 'x64', expected: 'go1.21.3.linux-amd64.tar.gz' },
    { platform: 'darwin', arch: 'arm64', expected: 'go1.21.3.darwin-arm64.tar.gz' }
];

let currentPlatform = testPlatforms[Math.floor(Math.random() * testPlatforms.length)];

// Mock tool lib functions
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        return null; // Not found, will trigger download
    },
    downloadTool: function(url: string) {
        console.log(`Download URL: ${url}`);
        if (url.includes(currentPlatform.expected)) {
            console.log(`${currentPlatform.platform.charAt(0).toUpperCase() + currentPlatform.platform.slice(1)}: ${currentPlatform.expected}`);
            return Promise.resolve('/mock/download/path');
        } else {
            throw new Error(`Expected filename ${currentPlatform.expected} not found in URL: ${url}`);
        }
    },
    extractTar: function(downloadPath: string) {
        return Promise.resolve('/mock/extract/path');
    },
    extractZip: function(downloadPath: string) {
        return Promise.resolve('/mock/extract/path');
    },
    cacheDir: function(sourceDir: string, tool: string, version: string) {
        return Promise.resolve('/mock/cache/go/1.21.3');
    },
    prependPath: function(toolPath: string) {
        console.log(`Adding to PATH: ${toolPath}`);
    }
});

// Mock os module with test platform
tmr.registerMock('os', {
    platform: () => currentPlatform.platform,
    arch: () => currentPlatform.arch
});

// Mock telemetry
tmr.registerMock('azure-pipelines-tasks-utility-common/telemetry', {
    emitTelemetry: function(area: string, feature: string, properties: any) {
        console.log(`Telemetry: ${area}.${feature}`);
    }
});

// Mock fs for version resolution
tmr.registerMock('fs', {
    readFileSync: function(filePath: string, encoding: string) {
        return JSON.stringify([{
            version: "go1.21.3",
            stable: true
        }]);
    }
});

tmr.run();