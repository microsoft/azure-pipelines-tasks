import * as path from 'path';
import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as testConstants from './TestConstants';

const taskPath = path.join(__dirname, '..', 'main.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Setup task inputs from environment variables
tmr.setInput('forceReinstallCredentialProvider', process.env[testConstants.TestEnvVars.forceReinstallCredentialProvider] || 'false');

if (process.env[testConstants.TestEnvVars.nuGetServiceConnections]) {
    tmr.setInput('nuGetServiceConnections', process.env[testConstants.TestEnvVars.nuGetServiceConnections]);
}

if (process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection]) {
    tmr.setInput('workloadIdentityServiceConnection', process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection]);
}

if (process.env[testConstants.TestEnvVars.feedUrl]) {
    tmr.setInput('feedUrl', process.env[testConstants.TestEnvVars.feedUrl]);
}

// Setup system variables
if (process.env[testConstants.TestEnvVars.systemAccessToken]) {
    tmr.setVariableName('SYSTEM_ACCESSTOKEN', process.env[testConstants.TestEnvVars.systemAccessToken], false);
    process.env['SYSTEM_ACCESSTOKEN'] = process.env[testConstants.TestEnvVars.systemAccessToken];
}

if (process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri]) {
    tmr.setVariableName('SYSTEM_TEAMFOUNDATIONCOLLECTIONURI', process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri], false);
    process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri];
}

if (process.env[testConstants.TestEnvVars.systemDebug]) {
    tmr.setVariableName('SYSTEM_DEBUG', process.env[testConstants.TestEnvVars.systemDebug], false);
    process.env['SYSTEM_DEBUG'] = process.env[testConstants.TestEnvVars.systemDebug];
}

// Mock answers
const answers: ma.TaskLibAnswers = {
    which: {
        'node': '/usr/bin/node'
    },
    exec: {},
    exist: {},
    checkPath: {}
};

tmr.setAnswers(answers);

// Mock the artifacts-common package functions
tmr.registerMock('azure-pipelines-tasks-artifacts-common/credentialProviderUtils', {
    installCredProviderToUserProfile: async function(forceReinstall: boolean, isV0: boolean = false) {
        console.log(`Mock: installCredProviderToUserProfile called with forceReinstall=${forceReinstall}, isV0=${isV0}`);
        if (process.env['__credProviderShouldFail__'] === 'true') {
            throw new Error('Simulated credential provider installation failure');
        }
    },
    configureCredProvider: async function(protocolType: any, serviceConnections: any[]) {
        console.log(`Mock: configureCredProvider called for ${protocolType} with ${serviceConnections.length} service connections`);
        // Set the environment variable to simulate credential provider configuration
        const endpointCredentials = serviceConnections.map(sc => ({
            endpoint: sc.packageSource.uri,
            username: sc.username || undefined,
            password: sc.password || sc.token
        }));
        const envVarValue = JSON.stringify({ endpointCredentials });
        
        // Output the VSO command so tests can detect it
        console.log(`##vso[task.setvariable variable=VSS_NUGET_EXTERNAL_FEED_ENDPOINTS]${envVarValue}`);
        
        // Also set it in process.env for backward compatibility
        process.env['VSS_NUGET_EXTERNAL_FEED_ENDPOINTS'] = envVarValue;
    },
    configureCredProviderForSameOrganizationFeeds: function(protocolType: any, serviceConnectionName: string) {
        console.log(`Mock: configureCredProviderForSameOrganizationFeeds called for ${protocolType} with connection ${serviceConnectionName}`);
        // Simulate setting up same-org feed authentication
    },
    configureEntraCredProvider: async function(protocolType: any, serviceConnectionName: string, feedUrl: string) {
        console.log(`Mock WIF: configureEntraCredProvider called for ${protocolType} with connection ${serviceConnectionName} and feedUrl ${feedUrl}`);
        if (process.env[testConstants.TestEnvVars.wifShouldFail] === 'true') {
            throw new Error('Simulated WIF authentication failure');
        }
        // Simulate successful WIF configuration
    }
});

tmr.registerMock('azure-pipelines-tasks-artifacts-common/protocols', {
    ProtocolType: {
        NuGet: 'NuGet',
        Npm: 'Npm',
        Maven: 'Maven',
        Pip: 'Pip',
        Cargo: 'Cargo'
    }
});

tmr.registerMock('azure-pipelines-tasks-artifacts-common/serviceConnectionUtils', {
    getPackagingServiceConnections: function(inputName: string): any[] {
        const mockConnections = process.env['__mockServiceConnections__'];
        if (mockConnections) {
            return JSON.parse(mockConnections);
        }
        return [];
    }
});

tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: function(area: string, feature: string, properties: any) {
        if (process.env['__throwTelemetryError__'] === 'true') {
            throw new Error('Simulated telemetry error');
        }
        console.log('Telemetry emitted:');
        console.log(`  Area: ${area}`);
        console.log(`  Feature: ${feature}`);
        console.log(`  Properties: ${JSON.stringify(properties)}`);
    }
});

// Run the task
tmr.run();
