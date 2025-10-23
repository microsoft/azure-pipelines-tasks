import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tmr.setInput('version', '1.21.3');

// Don't set Agent.TempDirectory to simulate missing environment variable
// process.env['Agent.TempDirectory'] = undefined;

// Mock tool lib functions
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        return null; // Not found, will trigger download which will fail due to missing temp dir
    },
    downloadTool: function(url: string) {
        // This shouldn't be reached if temp dir check fails first
        return Promise.resolve('/mock/download/path');
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