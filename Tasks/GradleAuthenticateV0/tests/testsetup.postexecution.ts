// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

// This file is spawned as a child process by MockTestRunner.
// It configures a TaskMockRunner for the postexecution entry point.

import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'src', 'postexecution.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// ---------------------------------------------------------------------------
// System variables (set by test scenarios via process.env)
// ---------------------------------------------------------------------------
tmr.registerMockExport('getVariable', (name: string) => {
    const vars: Record<string, string> = {
        'ARTIFACTS_GRADLE_AUTH_INIT_SCRIPT_PATH': process.env['__postexec_initScriptPath__'] || '',
        'ARTIFACTS_GRADLE_AUTH_TEMP_DIR': process.env['__postexec_tempDir__'] || '',
    };
    return vars[name] || undefined;
});

tmr.run();
