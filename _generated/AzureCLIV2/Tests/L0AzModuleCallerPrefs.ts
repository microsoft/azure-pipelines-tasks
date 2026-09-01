import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

// This test spawns a real pwsh process — no mocks needed.
// The _task.ts writes a PS script, executes it, and logs results.
let taskPath = path.join(__dirname, 'L0AzModuleCallerPrefs_task.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
tmr.run();
