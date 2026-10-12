import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as path from 'path';
import * as testConstants from './TestConstants';

// Get the task path
const taskPath = path.join(__dirname, '..', 'pipauthenticatemain.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set task inputs from test configuration
if (process.env[testConstants.TestEnvVars.artifactFeeds]) {
    tr.setInput('artifactFeeds', process.env[testConstants.TestEnvVars.artifactFeeds]);
}

if (process.env[testConstants.TestEnvVars.onlyAddExtraIndex]) {
    tr.setInput('onlyAddExtraIndex', process.env[testConstants.TestEnvVars.onlyAddExtraIndex]);
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

// Use shared MockHelper from common packages for consistency
const pkgMock = require('azure-pipelines-tasks-artifacts-common/Tests/MockHelper');
pkgMock.registerLocationHelpersMock(tr);

// Override connectionDataUtils to produce clean, predictable feed URLs with the feed name
// visible in the path. The default mock from registerLocationHelpersMock can produce garbled
// output under nyc's --all instrumentation, breaking URL-content assertions.
const collectionBase = (process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] || 'https://dev.azure.com/testorg/').replace(/\/$/, '');
tr.registerMock('azure-pipelines-tasks-artifacts-common/connectionDataUtils', {
    getPackagingRouteUrl: function(protocolType: any, apiVersion: string, locationGuid: string, feedId: string, project: string | null): string {
        const projectSegment = project ? `${project}/` : '';
        return `${collectionBase}/${projectSegment}_packaging/${feedId}/pypi/simple/`;
    }
});

// Override webapi mock to return the test-specific access token.
// MockHelper hardcodes 'token' for getSystemAccessToken, which would prevent
// asserting that the correct token was embedded in the authentication URL.
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

// Register mock for utilities module that has getUriWithCredentials
tr.registerMock('./utilities', {
    addCredentialsToUri: function(username: string, password: string, feedUri: string) {
        return `https://${username}:${password}@${feedUri.replace('https://', '')}`;
    },
    getUriWithCredentials: function(endpointId: string) {
        // Mock external endpoint URI with credentials
        return `https://external:token@pypi.org/${endpointId}/simple/`;
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
tr.registerMock('azure-pipelines-tasks-artifacts-common/feedUrlUtils', {
    parseAzureArtifactsFeedUrl: (feedUrl: string) => new URL(feedUrl),
    verifyAzureArtifactsFeedUrl: async function(feedUrl: URL) {
        const parsedFeedUrl = feedUrl;
        if (parsedFeedUrl.protocol !== 'https:' ||
            (parsedFeedUrl.hostname !== 'dev.azure.com' && !parsedFeedUrl.hostname.endsWith('.dev.azure.com'))) {
            throw new Error('Error_FeedUrlUntrustedHost');
        }
        return parsedFeedUrl;
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
    getFederatedWorkloadIdentityCredentialsForFeed: async function(serviceConnectionName: string, feedUrl: string) {
        console.log(`Mock WIF: getFederatedWorkloadIdentityCredentialsForFeed called with ${serviceConnectionName}`);
        if (wifShouldFail) {
            throw new Error('Simulated WIF authentication failure');
        }
        const parsedFeedUrl = new URL(feedUrl);
        if (parsedFeedUrl.protocol !== 'https:' ||
            (parsedFeedUrl.hostname !== 'dev.azure.com' && !parsedFeedUrl.hostname.endsWith('.dev.azure.com'))) {
            throw new Error('Error_FeedUrlUntrustedHost');
        }
        return wifToken ? { accessToken: wifToken, feedUrl: parsedFeedUrl } : undefined;
    }
});

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
