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
process.env['GOTOOL_GODOWNLOADURL'] = 'https://example.com/invalid';

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs with invalid URL in environment variable
tmr.setInput('version', '1.21.3');

// Mock os module
tmr.registerMock('os', {
    platform: (): string => 'linux',
    arch: (): string => 'x64'
});

// Mock telemetry (may not be called due to early failure)
tmr.registerMock('azure-pipelines-tasks-utility-common/telemetry', {
    emitTelemetry: function(area: string, feature: string, properties: any): void {
        console.log(`Telemetry: ${area}.${feature}`);
    }
});

tmr.run();
