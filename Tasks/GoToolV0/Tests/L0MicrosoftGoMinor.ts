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

// Set inputs for Microsoft Go with major.minor version
tmr.setInput('version', '1.25');
tmr.setInput('goDownloadBaseUrl', 'https://aka.ms/golang/release/latest');
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        console.log(`Looking for cached tool: ${toolName} version ${version}`);
        return null; // Not found, will trigger download
    },
    downloadTool: function(url: string) {
        console.log(`Download URL: ${url}`);
        if (url === 'https://aka.ms/golang/release/latest/go1.25.assets.json') {
            // Mock downloading Microsoft manifest
            return Promise.resolve('/mock/manifest/go1.25.assets.json');
        } else if (url.includes('https://aka.ms/golang/release/latest/go1.25.0')) {
            return Promise.resolve('/mock/download/go1.25.0.tar.gz');
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
        return Promise.resolve('/mock/cache/go-aka/1.25.0');
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

// Mock fs to read manifest
tmr.registerMock('fs', {
    readFileSync: function(filePath: string, encoding: string) {
        // Mock Microsoft manifest for Go 1.25
        return JSON.stringify({
            version: "1.25.0",
            files: []
        });
    }
});

tmr.run();
