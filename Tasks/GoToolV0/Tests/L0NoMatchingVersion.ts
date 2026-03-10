import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs for an unreleased minor version (e.g., Go 1.99 which doesn't exist)
tmr.setInput('version', '1.99');

// Mock environment variables  
tmr.setVariableName('Agent.TempDirectory', '/tmp/agent');

// Mock tool lib functions
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        return null; // Not cached
    },
    downloadTool: function(url: string) {
        if (url === 'https://go.dev/dl/?mode=json&include=all') {
            console.log('Fetching Go releases metadata');
            return Promise.resolve('/mock/metadata/releases.json');
        } else {
            throw new Error(`Unexpected download URL: ${url}`);
        }
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

// Mock fs with releases that don't include 1.99
tmr.registerMock('fs', {
    readFileSync: function(filePath: string, encoding: string) {
        // Return releases without 1.99
        return JSON.stringify([
            {
                version: "go1.22.3",
                stable: true
            },
            {
                version: "go1.21.5",
                stable: true
            },
            {
                version: "go1.20.12",
                stable: true
            }
        ]);
    }
});

tmr.run();
