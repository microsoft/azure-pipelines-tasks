import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs for Microsoft download source
tmr.setInput('version', '1.21.3');
tmr.setInput('goDownloadSource', 'microsoft');

// Mock environment variables  
tmr.setVariableName('Agent.TempDirectory', '/tmp/agent');

// Mock tool lib functions
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        return null; // Not found, will trigger download
    },
    downloadTool: function(url: string) {
        console.log(`Download URL: ${url}`);
        if (url.includes('https://aka.ms/golang/release/latest/go1.21.3')) {
            console.log('✓ Correct Microsoft download URL used');
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
        console.log(`Telemetry: ${area}.${feature} - downloadSource: ${properties.downloadSource}`);
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