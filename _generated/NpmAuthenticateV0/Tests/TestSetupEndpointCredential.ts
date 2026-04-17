// Test setup that exercises the REAL npmrcCredential.resolveServiceEndpointCredential
// (no mock). Endpoint auth provided via ENDPOINT_AUTH_* / ENDPOINT_URL_* env vars.

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

process.env['AGENT_BUILDDIRECTORY'] = os.tmpdir();

const _saveNpmrcBase = path.join(os.tmpdir(), 'npmAuthenticate');
if (!fs.existsSync(_saveNpmrcBase)) {
    fs.mkdirSync(_saveNpmrcBase, { recursive: true });
}
process.env['SAVE_NPMRC_PATH'] = fs.mkdtempSync(_saveNpmrcBase + path.sep);

process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = TestData.systemAccessToken;
process.env['ENDPOINT_AUTH_SCHEME_SYSTEMVSSCONNECTION'] = 'OAuth';

// Set up real endpoint auth via env vars
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
        process.env[`ENDPOINT_AUTH_${endpointId}`] = JSON.stringify({
            scheme: 'UsernamePassword',
            parameters: {
                username: process.env[TestEnvVars.endpointUsername] || 'testuser',
                password: process.env[TestEnvVars.endpointPassword] || 'testpass'
            }
        });
    }
}

tr.registerMock('azure-pipelines-tasks-packaging-common/locationUtilities', {
    getPackagingUris: async function () {
        return { PackagingUris: [TestData.collectionUri] };
    },
    ProtocolType: { Npm: 1 }
});

tr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: function (area: string, feature: string, data: any) {
        console.log(`${TestData.telemetryPrefix}${area}.${feature}:${JSON.stringify(data)}`);
    }
});

tr.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', {
    getFederatedWorkloadIdentityCredentials: async function () { return null; },
    getFeedTenantId: async function () { return 'mock-tenant-id'; }
});

// Mock http/https for isEndpointInternal probe
const isInternalEndpoint = process.env[TestEnvVars.isInternalEndpoint] === 'true';
const httpProbeShouldFail = process.env[TestEnvVars.httpProbeShouldFail] === 'true';
const mockHttpModule = {
    get: function (_url: any, _options: any, callback: Function) {
        if (httpProbeShouldFail) {
            return {
                on: function (event: string, handler: Function) {
                    if (event === 'error') { handler(new Error('Simulated network error')); }
                }
            };
        }
        const mockResponse = {
            rawHeaders: isInternalEndpoint
                ? ['X-TFS-ServiceVersion', '3.0', 'X-VSS-E2EID', 'abc-123']
                : ['Content-Type', 'application/json'],
            resume: function () {}
        };
        if (callback) { callback(mockResponse); }
        return { on: function () {} };
    }
};
tr.registerMock('https', mockHttpModule);
tr.registerMock('http', mockHttpModule);

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
