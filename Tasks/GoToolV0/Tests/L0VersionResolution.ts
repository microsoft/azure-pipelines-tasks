import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs for version resolution (major.minor format)
tmr.setInput('version', '1.21');

// Mock environment variables  
tmr.setVariableName('Agent.TempDirectory', '/tmp/agent');

// Mock tool lib functions
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        console.log(`Looking for cached tool: ${toolName} version ${version}`);
        return null; // Not found, will trigger version resolution and download
    },
    downloadTool: function(url: string) {
        if (url === 'https://go.dev/dl/?mode=json&include=all') {
            console.log('Fetching Go releases metadata for version resolution');
            return Promise.resolve('/mock/metadata/releases.json');
        } else if (url.includes('go1.21.5')) {
            console.log('Resolved version 1.21 to 1.21.5');
            return Promise.resolve('/mock/download/go1.21.5.tar.gz');
        } else {
            throw new Error(`Unexpected download URL: ${url}`);
        }
    },
    extractTar: function(downloadPath: string) {
        return Promise.resolve('/mock/extract/path');
    },
    cacheDir: function(sourceDir: string, tool: string, version: string) {
        console.log(`Caching Go version ${version}`);
        return Promise.resolve('/mock/cache/go/1.21.5');
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
        console.log(`Telemetry: ${area}.${feature} - version: ${properties.version}`);
    }
});

// Mock fs for version resolution - simulate Go releases metadata
tmr.registerMock('fs', {
    readFileSync: function(filePath: string, encoding: string) {
        // Mock Go releases with multiple patch versions for 1.21
        return JSON.stringify([
            {
                version: "go1.22.1",
                stable: true
            },
            {
                version: "go1.21.5", // Latest patch for 1.21
                stable: true
            },
            {
                version: "go1.21.4",
                stable: true
            },
            {
                version: "go1.21.3",
                stable: true
            },
            {
                version: "go1.21.2",
                stable: true
            },
            {
                version: "go1.21.1",
                stable: true
            },
            {
                version: "go1.21.0",
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