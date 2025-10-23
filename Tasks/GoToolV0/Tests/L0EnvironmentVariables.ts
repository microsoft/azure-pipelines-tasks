import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs with custom GOPATH and GOBIN
tmr.setInput('version', '1.21.3');
tmr.setInput('goPath', '/custom/gopath');
tmr.setInput('goBin', '/custom/gobin');

// Mock environment variables
process.env['Agent.TempDirectory'] = path.join(__dirname, 'temp');

// Mock tool lib functions
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        // Return cached version to skip download and focus on env vars
        console.log('Found cached Go version');
        return '/mock/cache/go/1.21.3';
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

tmr.run();