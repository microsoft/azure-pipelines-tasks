import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs for cached Microsoft Go version
tmr.setInput('version', '1.25.0');
tmr.setInput('goDownloadBaseUrl', 'https://aka.ms/golang/release/latest');

// Mock environment variables
process.env['Agent.TempDirectory'] = path.join(__dirname, 'temp');

// Mock tool lib functions
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        console.log(`Found cached tool: ${toolName} version ${version}`);
        // Return cached path to simulate found Microsoft build
        return '/mock/cache/go-aka/1.25.0';
    },
    downloadTool: function(url: string) {
        // Microsoft Go needs to download manifest even when version is cached
        console.log(`Downloading manifest from: ${url}`);
        if (url.includes('go1.25.0.assets.json')) {
            return Promise.resolve('/mock/manifest.json');
        }
        throw new Error(`Unexpected download URL: ${url}`);
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

// Mock fs to return manifest data
tmr.registerMock('fs', {
    readFileSync: function(filePath: string, encoding: string) {
        console.log(`Reading file: ${filePath}`);
        if (filePath.includes('manifest.json')) {
            // Return Microsoft Go manifest with version field (lowercase)
            return JSON.stringify({
                version: "1.25.0-1",
                files: [
                    {
                        filename: "go1.25.0-1.linux-amd64.tar.gz",
                        os: "linux",
                        arch: "amd64"
                    }
                ]
            });
        }
        return JSON.stringify({});
    }
});

tmr.run();
