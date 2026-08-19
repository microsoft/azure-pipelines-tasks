// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

// This file is spawned as a child process by MockTestRunner.
// It configures a TaskMockRunner with inputs/variables read from process.env
// (set by individual test scenario files) and runs the task.

import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import { TestEnvVars } from './testconstants';

const taskPath = path.join(__dirname, '..', 'src', 'main.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// ---------------------------------------------------------------------------
// Task inputs (read from env vars set by test scenarios)
// ---------------------------------------------------------------------------
if (process.env[TestEnvVars.buildFiles]) {
    tmr.setInput('buildFiles', process.env[TestEnvVars.buildFiles]!);
}
if (process.env[TestEnvVars.repositoryUrl]) {
    tmr.setInput('repositoryUrl', process.env[TestEnvVars.repositoryUrl]!);
}
if (process.env[TestEnvVars.adoServiceConnection]) {
    tmr.setInput('adoServiceConnection', process.env[TestEnvVars.adoServiceConnection]!);
}
if (process.env[TestEnvVars.pluginToolVersion]) {
    tmr.setInput('pluginToolVersion', process.env[TestEnvVars.pluginToolVersion]!);
}
if (process.env[TestEnvVars.gradleUserHome]) {
    tmr.setInput('gradleUserHome', process.env[TestEnvVars.gradleUserHome]!);
}

// ---------------------------------------------------------------------------
// System variables & endpoint auth
// ---------------------------------------------------------------------------
const serviceConnectionId = process.env[TestEnvVars.adoServiceConnection] || '';

tmr.registerMockExport('getEndpointAuthorizationParameter', (id: string, key: string, _optional: boolean) => {
    if (serviceConnectionId && id === serviceConnectionId) {
        if (key === 'serviceprincipalid') return 'mock-client-id';
        if (key === 'tenantid') return 'mock-tenant-id';
    }
    return undefined;
});

// ---------------------------------------------------------------------------
// System variables (for WIF OIDC endpoint construction)
// ---------------------------------------------------------------------------
tmr.registerMockExport('getVariable', (name: string) => {
    const vars: Record<string, string> = {
        'System.OidcRequestUri': 'https://dev.azure.com/testorg/test-project-id/_apis/distributedtask/hubs/build/plans/test-plan-id/jobs/test-job-id/oidctoken',
        'ARTIFACTS_GRADLE_AUTH_INIT_SCRIPT_PATH': '',
        'ARTIFACTS_GRADLE_AUTH_TEMP_DIR': '',
    };
    return vars[name] || undefined;
});

// ---------------------------------------------------------------------------
// Mock the HTTP probe (probeFeedTenantId) to avoid real network calls
// ---------------------------------------------------------------------------
const httpMock = {
    get: (_url: string, _opts: any, callback: Function) => {
        const res = {
            headers: { 'x-vss-resourcetenant': 'mock-resource-tenant-id' },
            resume: () => {},
        };
        callback(res);
        return { on: () => {} };
    },
};

tmr.registerMock('https', httpMock);
tmr.registerMock('http', httpMock);

// Mock telemetry to avoid agent version checks in tests
tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: (_area: string, _feature: string, _data: any) => {}
});

tmr.run();
