import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tmr.setInput('version', '1.21.3');

// Mock environment variables
process.env['Agent.TempDirectory'] = path.join(__dirname, 'temp');

// Mock tool lib functions
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        return null; // Not found, will trigger download
    },
    downloadTool: function(url: string) {
        console.log(`Downloading Go from ${url}`);
        return Promise.resolve('/mock/download/go1.21.3.tar.gz');
    },
    extractTar: function(downloadPath: string) {
        console.log(`Extracting ${downloadPath}`);
        return Promise.resolve('/mock/extract/path');
    },
    cacheDir: function(sourceDir: string, tool: string, version: string) {
        let cachedPath = '/mock/cache/go/1.21.3';
        console.log(`Go tool is available under ${cachedPath}`);
        return Promise.resolve(cachedPath);
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