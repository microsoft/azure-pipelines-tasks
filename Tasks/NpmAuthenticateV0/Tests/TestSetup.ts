import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { TestEnvVars, TestData } from './TestConstants';

delete process.env['SYSTEM_DEBUG'];

const taskPath = path.join(__dirname, '..', 'npmauth.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

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

process.env['SYSTEM_ACCESSTOKEN'] =
    process.env[TestEnvVars.systemAccessToken] || TestData.systemAccessToken;
if (process.env[TestEnvVars.existingEndpoints]) {
    process.env['EXISTING_ENDPOINTS'] = process.env[TestEnvVars.existingEndpoints];
}
process.env['AGENT_BUILDDIRECTORY'] = os.tmpdir();

// Pre-create SAVE_NPMRC_PATH to avoid mkdtempSync issues in mock mode
const _saveNpmrcBase = path.join(os.tmpdir(), 'npmAuthenticate');
if (!fs.existsSync(_saveNpmrcBase)) {
    fs.mkdirSync(_saveNpmrcBase, { recursive: true });
}
const _saveNpmrcPath = fs.mkdtempSync(_saveNpmrcBase + path.sep);
process.env['SAVE_NPMRC_PATH'] = _saveNpmrcPath;

// SYSTEMVSSCONNECTION for resolveInternalFeedCredentials
process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = TestData.systemAccessToken;
process.env['ENDPOINT_AUTH_SCHEME_SYSTEMVSSCONNECTION'] = 'OAuth';

const packagingLocationShouldFail = process.env[TestEnvVars.packagingLocationShouldFail] === 'true';
tr.registerMock('azure-pipelines-tasks-packaging-common/locationUtilities', {
    getPackagingUris: async function () {
        if (packagingLocationShouldFail) {
            throw new Error('Simulated packaging location failure');
        }
        return { PackagingUris: [TestData.collectionUri] };
    },
    ProtocolType: { Npm: 1 }
});

const throwTelemetryError = process.env[TestEnvVars.throwTelemetryError] === 'true';
tr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: function (area: string, feature: string, data: any) {
        if (throwTelemetryError) {
            throw new Error('Simulated telemetry error');
        }
        console.log(`${TestData.telemetryPrefix}${area}.${feature}:${JSON.stringify(data)}`);
    }
});

const wifToken = process.env[TestEnvVars.wifToken];
const wifShouldFail = process.env[TestEnvVars.wifShouldFail] === 'true';
tr.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', {
    getFederatedWorkloadIdentityCredentials: async function (serviceConnectionName: string) {
        if (wifShouldFail) {
            throw new Error(`Simulated WIF failure for ${serviceConnectionName}`);
        }
        return wifToken;
    },
    getFeedTenantId: async function () { return 'mock-tenant-id'; }
});

// Mock http/https for isEndpointInternal probe (returns non-Azure DevOps response)
const mockHttpModule = {
    get: function (_url: any, _options: any, callback: Function) {
        const mockResponse = {
            rawHeaders: ['Content-Type', 'application/json'],
            resume: function () {}
        };
        if (callback) { callback(mockResponse); }
        return { on: function () {} };
    }
};
tr.registerMock('https', mockHttpModule);
tr.registerMock('http', mockHttpModule);

// Mock npmrcCredential for external endpoint tests to avoid needing
// real ENDPOINT_AUTH_* env vars in the basic integration tests
const extUrl = process.env[TestEnvVars.externalRegistryUrl] || '';
const extToken = process.env[TestEnvVars.externalRegistryToken] || '';
const customEndpoint = process.env[TestEnvVars.customEndpoint] || '';

if (customEndpoint) {
    tr.registerMock('./npmrcCredential', {
        resolveServiceEndpointCredential: async function () {
            const nerfDart = extUrl.replace(/^https?:/, '');
            return {
                url: extUrl,
                auth: `${nerfDart}:_authToken=${extToken}`
            };
        },
        NpmrcCredential: {}
    });
}

const npmrcShouldExist = process.env[TestEnvVars.npmrcShouldExist] !== 'false';
const answers: ma.TaskLibAnswers = {
    which: {},
    checkPath: {},
    exist: { [npmrcPath]: npmrcShouldExist },
    stats: {}
};
tr.setAnswers(answers);

if (require.main === module) {
    tr.run();
}
