import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as fs from 'fs';

// Create temporary directory for test
const tempDir = path.join(__dirname, '_temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Mock environment variables BEFORE creating TaskMockRunner
process.env['AGENT_TEMPDIRECTORY'] = tempDir;

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs for official Go with full patch version
tmr.setInput('version', '1.22.3');
// No goDownloadBaseUrl means official go.dev

// Mock tool lib functions
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        console.log(`Looking for cached tool: ${toolName} version ${version}`);
        return null; // Not found, will trigger download
    },
    downloadTool: function(url: string) {
        console.log(`Download URL: ${url}`);
        if (url.includes('https://go.dev/dl/go1.22.3')) {
            return Promise.resolve('/mock/download/go1.22.3.tar.gz');
        } else {
            throw new Error(`Unexpected download URL: ${url}`);
        }
    },
    extractTar: function(downloadPath: string) {
        return Promise.resolve('/mock/extract/path');
    },
    extractZip: function(downloadPath: string) {
        return Promise.resolve('/mock/extract/path');
    },
    cacheDir: function(sourceDir: string, tool: string, version: string) {
        console.log(`Caching tool: ${tool} version: ${version}`);
        return Promise.resolve('/mock/cache/go/1.22.3');
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

// Mock fs (not needed for full patch version, but included for safety)
tmr.registerMock('fs', {
    readFileSync: function(filePath: string, encoding: string) {
        return JSON.stringify([]);
    }
});

tmr.run();
