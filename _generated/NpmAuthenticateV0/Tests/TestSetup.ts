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

// ── Mock: http/https for isEndpointInternal probe ─────────────────────────────
// The inlined isEndpointInternal() does an HTTP GET to check for x-tfs/x-vss
// headers. We mock the https module to return external (no Azure DevOps headers)
// so Token endpoints get bearer auth formatting.

const mockHttpModule = {
    get: function (_url: any, _options: any, callback: Function) {
        // Simulate a non-Azure DevOps response (no x-tfs/x-vss headers)
        const mockResponse = {
            rawHeaders: ['Content-Type', 'application/json'],
            resume: function () {}
        };
        if (callback) { callback(mockResponse); }
        return {
            on: function (_event: string, _handler: Function) {}
        };
    }
};

tr.registerMock('https', mockHttpModule);
tr.registerMock('http', mockHttpModule);

// ── Endpoint auth mocks ───────────────────────────────────────────────────────
// resolveServiceEndpointCredential reads endpoint auth/URL from the task lib.
// TaskMockRunner does not support setEndpointAuthorization, so we mock the
// npmrcCredential module directly to provide controlled credentials.

const extUrl = process.env[TestEnvVars.externalRegistryUrl] || '';
const extToken = process.env[TestEnvVars.externalRegistryToken] || '';
const customEndpoint = process.env[TestEnvVars.customEndpoint] || '';

if (customEndpoint) {
    // Mock just resolveServiceEndpointCredential from our local module.
    // This avoids needing to mock tl.getEndpointAuthorization which TaskMockRunner
    // doesn't support well.
    tr.registerMock('./npmrcCredential', {
        resolveServiceEndpointCredential: async function (_endpointId: string, _normalizeRegistry: Function, _toNerfDart: Function) {
            const nerfDart = extUrl.replace(/^https?:/, '');
            return {
                url: extUrl,
                auth: `${nerfDart}:_authToken=${extToken}`,
                authOnly: true
            };
        },
        NpmrcCredential: {} // type-only export, not used at runtime
    });
}

// ── SYSTEMVSSCONNECTION mock ──────────────────────────────────────────────────
// resolveLocalNpmRegistries reads System.AccessToken via
// tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'AccessToken', false).
// The task lib reads this from environment variables in the form:
// ENDPOINT_AUTH_PARAMETER_<ID>_<KEY>

process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = TestData.systemAccessToken;
process.env['ENDPOINT_AUTH_SCHEME_SYSTEMVSSCONNECTION'] = 'OAuth';

// ── Task-lib answers ──────────────────────────────────────────────────────────

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
