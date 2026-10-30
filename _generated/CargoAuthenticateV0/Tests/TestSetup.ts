import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';
import * as fs from 'fs';
import * as testConstants from './TestConstants';

// Get the task path
const taskPath = path.join(__dirname, '..', 'cargoauthenticatemain.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set task inputs
const configFilePath = process.env[testConstants.TestEnvVars.configFilePath] || testConstants.TestData.validConfigFile;
tr.setInput('ConfigFile', configFilePath);

if (process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection]) {
    tr.setInput('workloadIdentityServiceConnection', process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection]);
}

if (process.env[testConstants.TestEnvVars.registryNames]) {
    tr.setInput('registryNames', process.env[testConstants.TestEnvVars.registryNames]);
}

if (process.env[testConstants.TestEnvVars.cargoServiceConnections]) {
    tr.setInput('cargoServiceConnections', process.env[testConstants.TestEnvVars.cargoServiceConnections]);
}

// Set environment variables from test configuration BEFORE creating the runner
if (process.env[testConstants.TestEnvVars.systemDebug]) {
    process.env['SYSTEM_DEBUG'] = process.env[testConstants.TestEnvVars.systemDebug];
}

if (process.env[testConstants.TestEnvVars.systemAccessToken]) {
    process.env['SYSTEM_ACCESSTOKEN'] = process.env[testConstants.TestEnvVars.systemAccessToken];
}

if (process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri]) {
    process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri];
}

// Mock telemetry
const shouldThrowTelemetryError = process.env['__throwTelemetryError__'] === 'true';

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
const feedVerificationShouldFail = process.env['__feedVerificationShouldFail__'] === 'true';

tr.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', {
    getFederatedWorkloadIdentityCredentialsForFeed: async function(serviceConnectionName: string, feedUrl: string) {
        console.log(`Mock WIF: getFederatedWorkloadIdentityCredentialsForFeed called with ${serviceConnectionName} and ${feedUrl}`);
        if (wifShouldFail) {
            throw new Error('Simulated WIF authentication failure');
        }
        const verifiedFeedUrl = new URL(feedUrl);
        if (verifiedFeedUrl.protocol !== 'https:' ||
            !verifiedFeedUrl.hostname.toLowerCase().endsWith('dev.azure.com')) {
            throw new Error('Error_FeedUrlUntrustedHost');
        }
        return wifToken ? { accessToken: wifToken, feedUrl: verifiedFeedUrl } : undefined;
    }
});

tr.registerMock('azure-pipelines-tasks-artifacts-common/feedUrlUtils', {
    verifyAzureArtifactsFeedUrl: async function(feedUrl: string | URL) {
        console.log(`Mock: verifyAzureArtifactsFeedUrl called with ${feedUrl}`);
        if (feedVerificationShouldFail) {
            throw new Error('Simulated feed verification failure');
        }

        let parsedFeedUrl: URL;
        try {
            parsedFeedUrl = typeof feedUrl === 'string' ? new URL(feedUrl) : feedUrl;
        } catch {
            throw new Error('loc_mock_Error_UrlInvalid');
        }
        if (parsedFeedUrl.protocol !== 'https:' ||
            (parsedFeedUrl.hostname !== 'dev.azure.com' &&
                parsedFeedUrl.hostname !== 'pkgs.dev.azure.com' &&
                !parsedFeedUrl.hostname.endsWith('.visualstudio.com'))) {
            throw new Error('loc_mock_Error_FeedUrlUntrustedHost');
        }
        return parsedFeedUrl;
    }
});

// Mock service connection utilities
tr.registerMock('azure-pipelines-tasks-artifacts-common/serviceConnectionUtils', {
    getPackagingServiceConnections: function(inputName: string) {
        console.log(`Mock: getPackagingServiceConnections called with ${inputName}`);
        const mockConnections = process.env['__mockServiceConnections__'];
        if (mockConnections) {
            return JSON.parse(mockConnections);
        }
        return [];
    },
    ServiceConnectionAuthType: {
        UsernamePassword: 'UsernamePassword',
        Token: 'Token'
    }
});

// Mock file system based on config
const mockConfigContent = process.env['__mockConfigContent__'] || testConstants.TestData.validTomlContent;
const configFileExists = process.env['__configFileExists__'] !== 'false';

tr.registerMock('fs', {
    readFileSync: function(filePath: string, encoding: string) {
        console.log(`Mock fs.readFileSync received original config path: ${filePath === configFilePath}`);
        if (filePath === configFilePath && configFileExists) {
            if (process.env['__configFileReadError__'] === 'true') {
                throw new Error(`Unable to read config file: ${filePath}`);
            }
            return mockConfigContent;
        }
        throw new Error(`File not found: ${filePath}`);
    },
    existsSync: function(filePath: string) {
        return filePath === configFilePath && configFileExists;
    }
});

// Provide answers for task mock
tr.setAnswers({
    exist: {
        [configFilePath]: configFileExists
    }
});

tr.run();
