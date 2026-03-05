/**
 * TestSetupEndpointCredential.ts
 *
 * Test setup that exercises the REAL npmrcCredential.resolveServiceEndpointCredential
 * instead of mocking it. Endpoint auth is provided via ENDPOINT_AUTH_* and
 * ENDPOINT_URL_* env vars. The https/http modules are mocked to control the
 * isEndpointInternal HTTP probe.
 */
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { TestEnvVars, TestData } from './TestConstants';

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

// ── System environment ────────────────────────────────────────────────────────

process.env['AGENT_BUILDDIRECTORY'] = os.tmpdir();

const _saveNpmrcBase = path.join(os.tmpdir(), 'npmAuthenticate');
if (!fs.existsSync(_saveNpmrcBase)) {
    fs.mkdirSync(_saveNpmrcBase, { recursive: true });
}
const _saveNpmrcPath = fs.mkdtempSync(_saveNpmrcBase + path.sep);
process.env['SAVE_NPMRC_PATH'] = _saveNpmrcPath;

// SYSTEMVSSCONNECTION — needed by resolveLocalNpmRegistries
process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = TestData.systemAccessToken;
process.env['ENDPOINT_AUTH_SCHEME_SYSTEMVSSCONNECTION'] = 'OAuth';

// ── External endpoint auth via env vars ───────────────────────────────────────
// The real resolveServiceEndpointCredential calls tl.getEndpointAuthorization
// and tl.getEndpointUrl, which read from ENDPOINT_AUTH_<id> and ENDPOINT_URL_<id>.

const endpointId = process.env[TestEnvVars.customEndpoint] || '';
const extUrl = process.env[TestEnvVars.externalRegistryUrl] || '';
const extToken = process.env[TestEnvVars.externalRegistryToken] || '';
const endpointAuthScheme = process.env[TestEnvVars.endpointAuthScheme] || 'Token';

if (endpointId && extUrl) {
    process.env[`ENDPOINT_URL_${endpointId}`] = extUrl;

    if (endpointAuthScheme === 'Token') {
        process.env[`ENDPOINT_AUTH_${endpointId}`] = JSON.stringify({
            scheme: 'Token',
            parameters: { apitoken: extToken }
        });
    } else if (endpointAuthScheme === 'UsernamePassword') {
        const username = process.env[TestEnvVars.endpointUsername] || 'testuser';
        const password = process.env[TestEnvVars.endpointPassword] || 'testpass';
        process.env[`ENDPOINT_AUTH_${endpointId}`] = JSON.stringify({
            scheme: 'UsernamePassword',
            parameters: { username, password }
        });
    }
}

// ── Mock: packaging location ──────────────────────────────────────────────────

tr.registerMock('azure-pipelines-tasks-packaging-common/locationUtilities', {
    getPackagingUris: async function () {
        return { PackagingUris: [TestData.collectionUri] };
    },
    ProtocolType: { Npm: 1 }
});

// ── Mock: telemetry ───────────────────────────────────────────────────────────

tr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: function (area: string, feature: string, data: any) {
        console.log(`${TestData.telemetryPrefix}${area}.${feature}:${JSON.stringify(data)}`);
    }
});

// ── Mock: WIF (not used in these tests but needed for WIF build) ──────────────

tr.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', {
    getFederatedWorkloadIdentityCredentials: async function () { return null; },
    getFeedTenantId: async function () { return 'mock-tenant-id'; }
});

// ── Mock: http/https for isEndpointInternal probe ─────────────────────────────
// Control whether the probe sees Azure DevOps headers or external headers.

const isInternalEndpoint = process.env[TestEnvVars.isInternalEndpoint] === 'true';

const mockHttpModule = {
    get: function (_url: any, _options: any, callback: Function) {
        const mockResponse = {
            rawHeaders: isInternalEndpoint
                ? ['X-TFS-ServiceVersion', '3.0', 'X-VSS-E2EID', 'abc-123']
                : ['Content-Type', 'application/json'],
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
