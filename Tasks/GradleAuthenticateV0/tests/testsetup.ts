// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

// This file is spawned as a child process by MockTestRunner.
// It configures a TaskMockRunner with inputs/variables read from process.env
// (set by individual test scenario files) and runs the task.

import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import { TestData, TestEnvVars } from './testconstants';

const taskPath = path.join(__dirname, '..', 'src', 'main.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const providerScenario = process.env[TestEnvVars.ciProviderScenario];
if (providerScenario) {
    const bundle = path.resolve(process.env[TestEnvVars.agentTempDirectory]!, '..', 'bundled-provider');
    const approvedContent = Buffer.from('approved-provider-jar');
    if (!fs.existsSync(bundle) && providerScenario !== 'missing-bundle') {
        fs.mkdirSync(bundle);
        if (providerScenario !== 'missing-jar') {
            const directory = providerScenario === 'nested-layout' ? path.join(bundle, 'nested') : bundle;
            fs.mkdirSync(directory, { recursive: true });
            const jar = path.join(directory, 'artifacts-gradle-credprovider-1.0.0.jar');
            const content = providerScenario === 'checksum-mismatch' ? Buffer.from('unexpected-provider-jar') : approvedContent;
            fs.writeFileSync(jar, content);
            fs.writeFileSync(`${jar}.sha256`, createHash('sha256').update(content).digest('hex'));
        }
    }

    const checksum = createHash('sha256').update(approvedContent).digest('hex');
    tmr.registerMock('../data/credprovider-release.json', {
        jarSha256: providerScenario === 'invalid-release' ? 'not-a-sha256'
            : providerScenario === 'missing-digest' ? undefined
            : providerScenario === 'invalid-digest-type' ? 123 : checksum.toUpperCase(),
    });
    const packagedBundle = path.join(__dirname, '..', 'GradleCredProvider');
    tmr.registerMock('path', {
        ...path,
        join: (...parts: string[]): string => {
            const joined = path.join(...parts);
            return joined === packagedBundle ? bundle : joined;
        },
    });
    tmr.registerMock('fs', {
        ...fs,
        readFileSync: (...args: Parameters<typeof fs.readFileSync>): ReturnType<typeof fs.readFileSync> => {
            const [file] = args;
            const isProvider = typeof file === 'string' && file.startsWith(bundle + path.sep) && file.endsWith('.jar');
            if (isProvider && providerScenario === 'jar-read-failure') {
                throw new Error('test provider read failed');
            }
            const content = fs.readFileSync(...args);
            if (isProvider) {
                console.log('TEST_PROVIDER_JAR_READ');
                if (providerScenario === 'snapshot-race') fs.writeFileSync(file, 'replacement-after-read');
            }
            return content;
        },
    });
}

// ---------------------------------------------------------------------------
// Task inputs (read from env vars set by test scenarios)
// ---------------------------------------------------------------------------
if (process.env[TestEnvVars.initScriptBirthtime] !== undefined) {
    tmr.registerMock('fs', {
        ...fs,
        lstatSync: (file: fs.PathLike, options?: fs.StatSyncOptions) => {
            const stat = fs.lstatSync(file, options);
            return stat && options?.bigint
                ? { ...stat, birthtimeNs: BigInt(process.env[TestEnvVars.initScriptBirthtime]!) }
                : stat;
        },
    });
}

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
        'Agent.TempDirectory': process.env[TestEnvVars.agentTempDirectory] || '',
        'ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO': process.env['ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO']
            || process.env[TestEnvVars.existingRepoDir] || '',
        'ARTIFACTS_GRADLE_AUTH_CONFIG': process.env['ARTIFACTS_GRADLE_AUTH_CONFIG']
            || process.env[TestEnvVars.existingAuthConfig] || '',
        'System.JobId': process.env[TestEnvVars.jobId] ?? TestData.jobId,
        'System.JobAttempt': process.env[TestEnvVars.jobAttempt] ?? '1',
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
    emitTelemetry: (area: string, feature: string, data: Record<string, unknown>) => {
        console.log('TEST_TELEMETRY:' + JSON.stringify({ area, feature, data }));
    }
});

tmr.run();
