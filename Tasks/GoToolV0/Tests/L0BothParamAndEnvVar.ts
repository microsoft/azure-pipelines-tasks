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
process.env['GOTOOL_GODOWNLOADURL'] = 'https://example.com/alternate';

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs - both parameter and environment variable
tmr.setInput('version', '1.21.3');
tmr.setInput('goDownloadUrl', 'https://go.dev/dl');

// Mock tool-lib
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, versionSpec: string): string | null {
        return null;
    },
    downloadTool: function(url: string): Promise<string> {
        console.log(`Download URL: ${url}`);
        // Verify it uses the parameter URL (go.dev/dl), not the env var (example.com)
        if (url.includes('go.dev/dl')) {
            console.log('Correctly using parameter URL over environment variable');
        }
        return Promise.resolve('/mock/download/path');
    },
    extractTar: function(file: string): Promise<string> {
        return Promise.resolve('/mock/extract/path');
    },
    extractZip: function(file: string): Promise<string> {
        return Promise.resolve('/mock/extract/path');
    },
    cacheDir: function(sourceDir: string, tool: string, version: string): Promise<string> {
        return Promise.resolve('/mock/cache/path');
    },
    prependPath: function(toolPath: string): void {
        console.log(`Adding to PATH: ${toolPath}`);
    }
});

// Mock os module
tmr.registerMock('os', {
    platform: (): string => 'linux',
    arch: (): string => 'x64'
});

// Mock telemetry
tmr.registerMock('azure-pipelines-tasks-utility-common/telemetry', {
    emitTelemetry: function(area: string, feature: string, properties: any): void {
        console.log(`Telemetry: ${area}.${feature}`);
    }
});

tmr.run();
