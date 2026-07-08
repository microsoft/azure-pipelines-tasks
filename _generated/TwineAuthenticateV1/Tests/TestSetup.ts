import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as testConstants from './TestConstants';

// Get the task path
const taskPath = path.join(__dirname, '..', 'twineauthenticatemain.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set task inputs from test configuration
if (process.env[testConstants.TestEnvVars.artifactFeed]) {
    tr.setInput('artifactFeed', process.env[testConstants.TestEnvVars.artifactFeed]);
}

if (process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection]) {
    tr.setInput('workloadIdentityServiceConnection', process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection]);
}

if (process.env[testConstants.TestEnvVars.feedUrl]) {
    tr.setInput('feedUrl', process.env[testConstants.TestEnvVars.feedUrl]);
}

// Set environment variables from test configuration
if (process.env[testConstants.TestEnvVars.systemDebug]) {
    process.env['SYSTEM_DEBUG'] = process.env[testConstants.TestEnvVars.systemDebug];
}

// Simulate authentication failure if requested
if (process.env[testConstants.TestEnvVars.simulateAuthFailure] === 'true') {
    // Don't set access token to simulate auth failure
    delete process.env['SYSTEM_ACCESSTOKEN'];
} else if (process.env[testConstants.TestEnvVars.systemAccessToken]) {
    process.env['SYSTEM_ACCESSTOKEN'] = process.env[testConstants.TestEnvVars.systemAccessToken];
}

if (process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri]) {
    process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri];
}

// Ensure temp directory exists for .pypirc file
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Use shared MockHelper from common packages for consistency
const pkgMock = require('azure-pipelines-tasks-artifacts-common/Tests/MockHelper');
pkgMock.registerLocationHelpersMock(tr);

// Override webapi mock to return the test-specific access token.
// MockHelper hardcodes 'token' for getSystemAccessToken, which would prevent
// asserting that the correct token appears in .pypirc credentials.
const testSystemAccessToken = process.env['SYSTEM_ACCESSTOKEN'] || 'token';
tr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', {
    getSystemAccessToken: function() {
        return testSystemAccessToken;
    },
    getWebApiWithProxy: function(serviceUri: string, accessToken: string) {
        return {
            vsoClient: {
                getVersioningData: function(ApiVersion: string, PackagingAreaName: string, PackageAreaId: string, Obj: any) {
                    return Promise.resolve({ requestUrl: 'foobar' });
                }
            }
        };
    }
});

// Mock serviceConnectionUtils for external endpoints
tr.registerMock('azure-pipelines-tasks-artifacts-common/serviceConnectionUtils', {
    getPackagingServiceConnections: function(inputKey: string) {
        const externalEndpoints = process.env[testConstants.TestEnvVars.externalEndpoints];
        if (externalEndpoints) {
            return externalEndpoints.split(',');
        }
        return [];
    }
});

// Mock telemetry with enhanced error simulation
const shouldThrowTelemetryError = process.env[testConstants.TestEnvVars.throwTelemetryError] === 'true';

tr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: function(area: string, feature: string, data: any) {
        if (shouldThrowTelemetryError) {
            throw new Error('Simulated telemetry error');
        }
        console.log(`Telemetry emitted: ${area}.${feature} with data: ${JSON.stringify(data)}`);
    }
});

// Mock WIF credentials provider
const wifToken = process.env[testConstants.TestEnvVars.wifToken];
const wifShouldFail = process.env[testConstants.TestEnvVars.wifShouldFail] === 'true';

tr.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', {
    getFederatedWorkloadIdentityCredentials: async function(serviceConnectionName: string, tenantId?: string) {
        console.log(`Mock WIF: getFederatedWorkloadIdentityCredentials called with ${serviceConnectionName}`);
        if (wifShouldFail) {
            throw new Error('Simulated WIF authentication failure');
        }
        return wifToken;
    },
    getFeedTenantId: async function(feedUrl: string) {
        console.log(`Mock WIF: getFeedTenantId called with ${feedUrl}`);
        return 'mock-tenant-id-12345';
    }
});

// Mock the utilities module
tr.registerMock('./utilities', {
    getPypircPath: function() {
        return path.join(tempDir, '.pypirc');
    }
});

// Wire up external endpoint data so tl.getEndpointUrl / getEndpointAuthorization
// return real values when the test sets the externalEndpoints env var.
// Without this, getExternalAuthInfoArray() receives no task input and silently
// returns an empty set, meaning external endpoint sections never appear in .pypirc.
if (process.env[testConstants.TestEnvVars.externalEndpoints]) {
    const endpointId = process.env[testConstants.TestEnvVars.externalEndpoints].split(',')[0].trim();
    tr.setInput('pythonUploadServiceConnection', endpointId);
    // ENDPOINT_URL_<id>  — read by tl.getEndpointUrl(id)
    process.env[`ENDPOINT_URL_${endpointId}`] = `https://external.pypi.org/${endpointId}/simple/`;
    // ENDPOINT_DATA_<id>_ENDPOINTNAME  — key is uppercased by task-lib
    process.env[`ENDPOINT_DATA_${endpointId}_ENDPOINTNAME`] = endpointId;
    // ENDPOINT_AUTH_<id>  — read by tl.getEndpointAuthorization(id)
    process.env[`ENDPOINT_AUTH_${endpointId}`] = JSON.stringify({
        parameters: { apitoken: testConstants.TestData.externalEndpointToken },
        scheme: 'Token'
    });
    // ENDPOINT_AUTH_SCHEME_<id>  — read by tl.getEndpointAuthorizationScheme(id) via vault
    process.env[`ENDPOINT_AUTH_SCHEME_${endpointId}`] = 'Token';
}

// Set up mock answers
const answers: ma.TaskLibAnswers = {
    which: {},
    checkPath: {},
    exist: {},
    stats: {}
};

tr.setAnswers(answers);

// Run the task
tr.run();
