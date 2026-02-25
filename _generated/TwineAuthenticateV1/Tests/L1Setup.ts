// L1 Integration Test Setup for TwineAuthenticateV1
// Unlike L0 tests, this setup uses REAL file system operations
// Only credentials and service endpoints are mocked

import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as path from 'path';
import * as fs from 'fs';

// Get the task path
const taskPath = path.join(__dirname, '..', 'twineauthenticatemain.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// --- Input Configuration from L1 Test Environment Variables ---

// Internal feed configuration
if (process.env['__L1_ARTIFACT_FEED__']) {
    tr.setInput('artifactFeed', process.env['__L1_ARTIFACT_FEED__']);
}

// External endpoints configuration
if (process.env['__L1_EXTERNAL_ENDPOINTS__']) {
    tr.setInput('pythonUploadServiceConnection', process.env['__L1_EXTERNAL_ENDPOINTS__']);
}

// WIF configuration
if (process.env['__L1_WIF_SERVICE_CONNECTION__']) {
    tr.setInput('workloadIdentityServiceConnection', process.env['__L1_WIF_SERVICE_CONNECTION__']);
}

// Feed URL for WIF
if (process.env['__L1_FEED_URL__']) {
    tr.setInput('feedUrl', process.env['__L1_FEED_URL__']);
}

// ---Register Mocks FIRST (before answers) ---

// Mock utilities module with REAL file system operations
tr.registerMock('./utilities', {
    getPypircPath: function() {
        // Use REAL file system operations (not tl.mkdirP which gets intercepted)
        const tempPath = process.env['AGENT_TEMPDIRECTORY'];
        const twineAuthPath = path.join(tempPath, "twineAuthenticate");
        
        // Create the directory if it doesn't exist (REAL FS)
        if (!fs.existsSync(twineAuthPath)) {
            fs.mkdirSync(twineAuthPath, { recursive: true });
        }
        
        // Create unique temp directory (REAL FS)
        const uniqueDir = fs.mkdtempSync(twineAuthPath + path.sep);
        const pypircPath = path.join(uniqueDir, ".pypirc");
        
        return pypircPath;
    }
});

// Mock location helpers (feed URL resolution)
const pkgMock = require('azure-pipelines-tasks-artifacts-common/Tests/MockHelper');
pkgMock.registerLocationHelpersMock(tr);

// Mock service connection utilities for external endpoints
tr.registerMock('azure-pipelines-tasks-artifacts-common/serviceConnectionUtils', {
    getPackagingServiceConnections: function(inputKey: string) {
        const externalEndpoints = process.env['__L1_EXTERNAL_ENDPOINTS__'];
        if (externalEndpoints) {
            // Parse endpoint names and return service connection objects
            const endpointNames = externalEndpoints.split(',').map(s => s.trim());
            return endpointNames.map(name => ({
                packageSource: {
                    accountName: name,
                    accountId: `mock-account-id-${name}`,
                    packageType: 'PyPI',
                    projectId: 'mock-project-id'
                },
                endpointId: `mock-endpoint-${name}`,
                feedName: name,
                feedUri: `https://upload.pypi.org/legacy/`
            }));
        }
        return [];
    }
});

// Mock authentication module (don't make real auth calls)
tr.registerMock('./authentication', {
    getInternalAuthInfoArray: async function(inputKey: string, packagingLocation: any) {
        const artifactFeed = process.env['__L1_ARTIFACT_FEED__'];
        if (!artifactFeed) {
            return [];
        }

        const feedNames = artifactFeed.split(',').map(s => s.trim());
        const collectionUri = process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] || 'https://dev.azure.com/mock-org/';
        const accessToken = process.env['SYSTEM_ACCESSTOKEN'] || 'mock-token';

        return feedNames.map(feedName => ({
            feedName: feedName,
            feedUri: `${collectionUri}_packaging/${feedName}/pypi/upload`,
            username: 'build',
            password: accessToken
        }));
    },
    
    getExternalAuthInfoArray: async function(inputKey: string) {
        const serviceConnections = process.env['__L1_EXTERNAL_ENDPOINTS__'];
        if (!serviceConnections) {
            return [];
        }

        const connectionNames = serviceConnections.split(',').map(s => s.trim());
        return connectionNames.map(name => ({
            feedName: name,
            feedUri: `https://upload.pypi.org/legacy/`,
            username: `mock-user-${name}`,
            password: `mock-password-${name}`
        }));
    }
});

// Mock WIF credentials provider
tr.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', {
    getFederatedWorkloadIdentityCredentials: async function(serviceConnectionName: string, tenantId?: string) {
        console.log(`L1 Mock WIF: getFederatedWorkloadIdentityCredentials for ${serviceConnectionName}`);
        const wifToken = process.env['__L1_WIF_TOKEN__'] || 'mock-wif-token-12345';
        return wifToken;
    },
    
    getFeedTenantId: async function(feedUrl: string) {
        console.log(`L1 Mock WIF: getFeedTenantId for ${feedUrl}`);
        return process.env['__L1_TENANT_ID__'] || 'mock-tenant-id-67890';
    }
});

// Mock telemetry (don't send real telemetry)
tr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: function(area: string, feature: string, data: any) {
        console.log(`L1 Telemetry: ${area}.${feature} => ${JSON.stringify(data)}`);
    }
});

// --- Set Mock Answers AFTER mocks are registered ---

const answers: ma.TaskLibAnswers = {
    which: {},
    checkPath: {},
    exist: {},
    stats: {}
};

tr.setAnswers(answers);

//---  Environment Variables ---

if (process.env['AGENT_TEMPDIRECTORY']) {
    process.env['AGENT_TEMPDIRECTORY'] = process.env['AGENT_TEMPDIRECTORY'];
}

if (process.env['SYSTEM_ACCESSTOKEN']) {
    process.env['SYSTEM_ACCESSTOKEN'] = process.env['SYSTEM_ACCESSTOKEN'];
}

if (process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI']) {
    process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
}

// Run the task
tr.run();
