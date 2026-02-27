import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { TestEnvVars, TestData } from './TestConstants';

// Suppress debug noise from make.js setting SYSTEM_DEBUG=true
delete process.env['SYSTEM_DEBUG'];

const taskPath = path.join(__dirname, '..', 'npmauth.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// ── Inputs ────────────────────────────────────────────────────────────────────

const npmrcPath = process.env[TestEnvVars.npmrcPath] || '';
if (npmrcPath) {
    tr.setInput('workingFile', npmrcPath);
}

if (process.env[TestEnvVars.customEndpoint]) {
    tr.setInput('customEndpoint', process.env[TestEnvVars.customEndpoint]);
}

if (process.env[TestEnvVars.workloadIdentityServiceConnection]) {
    tr.setInput('workloadIdentityServiceConnection', process.env[TestEnvVars.workloadIdentityServiceConnection]);
}

if (process.env[TestEnvVars.wifRegistryUrl]) {
    tr.setInput('feedUrl', process.env[TestEnvVars.wifRegistryUrl]);
}

// ── System environment ────────────────────────────────────────────────────────

process.env['SYSTEM_ACCESSTOKEN'] =
    process.env[TestEnvVars.systemAccessToken] || TestData.systemAccessToken;

// Seed EXISTING_ENDPOINTS if the test wants to simulate a prior run of the task
if (process.env[TestEnvVars.existingEndpoints]) {
    process.env['EXISTING_ENDPOINTS'] = process.env[TestEnvVars.existingEndpoints];
}

// Give the task an Agent.BuildDirectory so it can create its temp save dir
process.env['AGENT_BUILDDIRECTORY'] = os.tmpdir();

// Pre-create SAVE_NPMRC_PATH so the task skips its mkdirP+mkdtempSync block.
// tl.mkdirP() in mock mode logs the path but does NOT create the directory on
// disk, so fs.mkdtempSync() would throw ENOENT if we let the task reach it.
const _saveNpmrcBase = path.join(os.tmpdir(), 'npmAuthenticate');
if (!fs.existsSync(_saveNpmrcBase)) {
    fs.mkdirSync(_saveNpmrcBase, { recursive: true });
}
const _saveNpmrcPath = fs.mkdtempSync(_saveNpmrcBase + path.sep);
process.env['SAVE_NPMRC_PATH'] = _saveNpmrcPath;

// ── Mock: packaging location (avoids HTTP) ────────────────────────────────────

tr.registerMock('azure-pipelines-tasks-packaging-common/locationUtilities', {
    getPackagingUris: async function () {
        return { PackagingUris: [TestData.collectionUri] };
    },
    ProtocolType: { Npm: 1 }
});

// ── Mock: npmutil — controls local registry discovery and auth writes ─────────

const localRegistriesJson = process.env[TestEnvVars.localRegistries];

tr.registerMock('azure-pipelines-tasks-packaging-common/npm/npmutil', {
    getLocalNpmRegistries: async function (_workingDir: string, _packagingUris: string[]) {
        if (localRegistriesJson) {
            return JSON.parse(localRegistriesJson);
        }
        return [];
    },
    appendToNpmrc: function (_npmrcFile: string, content: string) {
        // Write to disk — mirrors real tl.writeFile append behaviour so tests
        // can assert on the actual .npmrc file content after the task runs.
        fs.appendFileSync(_npmrcFile, content);
        // Also log so tests can assert on what was written via tr.stdout.
        // Trim surrounding newlines so the token stays on a single log line —
        // the task passes os.EOL + auth + os.EOL as content.
        console.log(`${TestData.appendPrefix}${content.trim()}`);
    }
});

// ── Mock: npmrcparser — controls what registries are parsed from .npmrc ───────

const npmrcRegistries = process.env[TestEnvVars.npmrcRegistries] || '';

tr.registerMock('azure-pipelines-tasks-packaging-common/npm/npmrcparser', {
    GetRegistries: function (_npmrcFile: string, _saveNormalized?: boolean) {
        return npmrcRegistries.split(';').filter(Boolean);
    },
    NormalizeRegistry: function (url: string) { return url; }
});

// ── Mock: npmregistry — controls external service-connection auth ─────────────

const extUrl = process.env[TestEnvVars.externalRegistryUrl] || TestData.externalRegistryUrl;
const extToken = process.env[TestEnvVars.externalRegistryToken] || TestData.externalRegistryToken;

// NpmRegistry must be a constructor (WIF code does `new npmregistry.NpmRegistry(url, auth)`)
// AND expose a static FromServiceEndpoint (external service connection path).
function NpmRegistryMock(this: any, url: string, auth: string) {
    this.url = url;
    this.auth = auth;
}
(NpmRegistryMock as any).FromServiceEndpoint = async function (_endpointId: string, _requireExists: boolean) {
    const nerfDart = extUrl.replace(/^https?:/, '');
    return { url: extUrl, auth: `${nerfDart}:_authToken=${extToken}` };
};

tr.registerMock('azure-pipelines-tasks-packaging-common/npm/npmregistry', {
    NpmRegistry: NpmRegistryMock
});

// ── Mock: packaging util ──────────────────────────────────────────────────────

tr.registerMock('azure-pipelines-tasks-packaging-common/util', {
    saveFileWithName: function () { /* no-op: skip backing up .npmrc */ },
    restoreFileWithName: function () {},
    logError: function (error: any) { console.error(String(error)); },
    toNerfDart: function (url: string) {
        // //host/path/: — strip the scheme, keep the rest
        return url.replace(/^https?:/, '');
    }
});

// ── Mock: telemetry ───────────────────────────────────────────────────────────

const throwTelemetryError = process.env[TestEnvVars.throwTelemetryError] === 'true';

tr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: function (area: string, feature: string, data: any) {
        if (throwTelemetryError) {
            throw new Error('Simulated telemetry error');
        }
        console.log(`${TestData.telemetryPrefix}${area}.${feature}:${JSON.stringify(data)}`);
    }
});

// ── Mock: WIF credentials ─────────────────────────────────────────────────────

const wifToken = process.env[TestEnvVars.wifToken];
const wifShouldFail = process.env[TestEnvVars.wifShouldFail] === 'true';

tr.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', {
    getFederatedWorkloadIdentityCredentials: async function (serviceConnectionName: string) {
        if (wifShouldFail) {
            throw new Error(`Simulated WIF failure for ${serviceConnectionName}`);
        }
        return wifToken;
    },
    getFeedTenantId: async function (_feedUrl: string) {
        return 'mock-tenant-id-12345';
    }
});

// ── Task-lib answers ──────────────────────────────────────────────────────────

// By default the .npmrc is considered to exist; set npmrcShouldExist='false' to test missing-file path
const npmrcShouldExist = process.env[TestEnvVars.npmrcShouldExist] !== 'false';

const answers: ma.TaskLibAnswers = {
    which: {},
    checkPath: {},
    exist: {
        [npmrcPath]: npmrcShouldExist
    },
    stats: {}
};

tr.setAnswers(answers);

// ── Run ───────────────────────────────────────────────────────────────────────

if (require.main === module) {
    tr.run();
}
