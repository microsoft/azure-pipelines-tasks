// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

// This file is spawned as a child process by MockTestRunner.
// It configures a TaskMockRunner for the postexecution entry point.

import * as path from 'path';
import * as fs from 'fs';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import { TestData, TestEnvVars } from './testconstants';

const taskPath = path.join(__dirname, '..', 'src', 'postexecution.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
if (process.env[TestEnvVars.gradleUserHome]) {
    tmr.setInput('gradleUserHome', process.env[TestEnvVars.gradleUserHome]!);
}

// ---------------------------------------------------------------------------
// System variables (set by test scenarios via process.env)
// ---------------------------------------------------------------------------
const realVariables = process.env[TestEnvVars.postexecRealVariables] === '1';
if (realVariables) {
    process.env['AGENT_TEMPDIRECTORY'] = process.env[TestEnvVars.agentTempDirectory];
    fs.mkdirSync(process.env[TestEnvVars.agentTempDirectory]!, { recursive: true });
    process.env['SYSTEM_JOBID'] = process.env[TestEnvVars.jobId] ?? TestData.jobId;
    process.env['SYSTEM_JOBATTEMPT'] = process.env[TestEnvVars.jobAttempt] ?? '1';
    process.env['VSTS_TASKVARIABLE_ARTIFACTS_GRADLE_AUTH_TEMP_DIR'] = process.env[TestEnvVars.postexecTemp] || '';
    process.env['VSTS_TASKVARIABLE_ARTIFACTS_GRADLE_AUTH_INIT_SCRIPT_PATH'] = process.env[TestEnvVars.postexecInitScript] || '';
    process.env[`VSTS_TASKVARIABLE_${TestData.initScriptIdentityVariable}`] = process.env[TestEnvVars.initScriptIdentity] || '';
} else {
    tmr.registerMockExport('getTaskVariable', (name: string) => {
        if (name === TestData.initScriptIdentityVariable) return process.env[TestEnvVars.initScriptIdentity];
        throw new Error('Cleanup must not read stored paths');
    });
    tmr.registerMockExport('getVariable', (name: string) => {
        if (name === 'System.JobId') return process.env[TestEnvVars.jobId] ?? TestData.jobId;
        if (name === 'System.JobAttempt') return process.env[TestEnvVars.jobAttempt] ?? '1';
        if (name === 'Agent.TempDirectory') return process.env[TestEnvVars.agentTempDirectory];
        return undefined;
    });
}

tmr.registerMock('fs', {
    ...fs,
    lstatSync: (file: fs.PathLike, options?: fs.StatSyncOptions) => {
        const stat = fs.lstatSync(file, options);
        if (stat && options?.bigint) {
            if (process.env[TestEnvVars.initScriptBirthtime] !== undefined) {
                return { ...stat, birthtimeNs: BigInt(process.env[TestEnvVars.initScriptBirthtime]!) };
            }
        }
        return stat;
    },
    rmSync: () => {
        console.log('TEST_DELETE_DIRECTORY');
        throw new Error('Directory deletion is forbidden');
    },
    unlinkSync: (file: fs.PathLike) => {
        console.log('TEST_DELETE_FILE');
        if (process.env[TestEnvVars.postexecDryRun] !== '1') fs.unlinkSync(file);
    },
});

const forbidden = (): never => { throw new Error('Post-job cleanup must not launch external tools'); };
tmr.registerMock('child_process', {
    ...require('child_process'),
    exec: forbidden, execSync: forbidden, execFile: forbidden, execFileSync: forbidden,
    spawn: forbidden, spawnSync: forbidden, fork: forbidden,
});

tmr.run(realVariables);
