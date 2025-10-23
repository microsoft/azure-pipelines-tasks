import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tmr.setInput('version', '1.21.3');

// Mock tool lib that doesn't need temp directory
tmr.registerMock('azure-pipelines-task-lib/task', {
    getVariable: (name: string) => {
        if (name === 'Agent.TempDirectory') return '/mock/temp';
        return undefined;
    }
});

// Mock tool lib functions
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        console.log(`Looking for cached tool: ${toolName} version ${version}`);
        return null; // Not found, will trigger download
    },
    downloadTool: function(url: string) {
        console.log(`Download URL: ${url}`);
        if (url.includes('https://go.dev/dl/go1.21.3')) {
            console.log('✓ Correct URL generated with go.dev domain');
            return Promise.resolve('/mock/download/path');
        } else {
            throw new Error(`Unexpected URL: ${url}`);
        }
    },
    extractTar: function(downloadPath: string) {
        return Promise.resolve('/mock/extract/path');
    },
    cacheDir: function(sourceDir: string, tool: string, version: string) {
        return Promise.resolve('/mock/cache/go/1.21.3');
    },
    prependPath: function(toolPath: string) {
        console.log(`Adding to PATH: ${toolPath}`);
    }
});

// Mock os module
tmr.registerMock('os', {
    platform: () => 'linux',
    arch: () => 'x64'
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