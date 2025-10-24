import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gotool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs with unsupported base URL
tmr.setInput('version', '1.21.3');
tmr.setInput('goDownloadBaseUrl', 'https://example.com/go');

// Mock os module
tmr.registerMock('os', {
    platform: () => 'linux',
    arch: () => 'x64'
});

// Mock telemetry (may not be called due to early failure)
tmr.registerMock('azure-pipelines-tasks-utility-common/telemetry', {
    emitTelemetry: function(area: string, feature: string, properties: any) {
        console.log(`Telemetry: ${area}.${feature}`);
    }
});

tmr.run();
