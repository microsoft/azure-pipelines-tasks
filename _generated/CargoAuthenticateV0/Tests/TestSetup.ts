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

tr.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', {
    getFederatedWorkloadIdentityCredentials: async function(serviceConnectionName: string, tenantId?: string) {
        console.log(`Mock WIF: getFederatedWorkloadIdentityCredentials called with ${serviceConnectionName}`);
        if (wifShouldFail) {
            throw new Error('Simulated WIF authentication failure');
        }
        return wifToken;
    },
    getFeedTenantId: function(feedUrl: string) {
        console.log(`Mock WIF: getFeedTenantId called with ${feedUrl}`);
        return 'mock-tenant-id';
    }
});

// Mock packaging location utilities
const packagingLocationShouldFail = process.env['__packagingLocationShouldFail__'] === 'true';

tr.registerMock('azure-pipelines-tasks-packaging-common/locationUtilities', {
    getPackagingUris: async function(protocolType: any) {
        console.log(`Mock: getPackagingUris called with protocol ${protocolType}`);
        if (packagingLocationShouldFail) {
            throw new Error('Unable to get packaging URIs - simulated service failure');
        }
        return {
            PackagingUris: [
                'https://pkgs.dev.azure.com/testorg/',
                'https://dev.azure.com/testorg/'
            ]
        };
    },
    ProtocolType: {
        Cargo: 'Cargo'
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

// Mock util
tr.registerMock('azure-pipelines-tasks-packaging-common/util', {
    logError: function(error: any) {
        console.log(`Mock util.logError: ${error}`);
    }
});

// Mock file system based on config
const mockConfigContent = process.env['__mockConfigContent__'] || testConstants.TestData.validTomlContent;
const configFileExists = process.env['__configFileExists__'] !== 'false';

tr.registerMock('fs', {
    readFileSync: function(filePath: string, encoding: string) {
        console.log(`Mock fs.readFileSync: ${filePath}`);
        if (filePath === configFilePath && configFileExists) {
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
