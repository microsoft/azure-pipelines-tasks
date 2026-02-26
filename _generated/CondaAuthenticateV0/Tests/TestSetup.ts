import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';
import * as testConstants from './TestConstants';

// Get the task path
const taskPath = path.join(__dirname, '..', 'condaauthenticatemain.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set task inputs for WIF if provided
if (process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection]) {
    tr.setInput('workloadIdentityServiceConnection', process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection]);
}

// Set environment variables from test configuration BEFORE creating the runner
if (process.env[testConstants.TestEnvVars.systemDebug]) {
    process.env['SYSTEM_DEBUG'] = process.env[testConstants.TestEnvVars.systemDebug];
}

// Set environment variables from test configuration
if (process.env[testConstants.TestEnvVars.systemAccessToken]) {
    process.env['SYSTEM_ACCESSTOKEN'] = process.env[testConstants.TestEnvVars.systemAccessToken];
}

if (process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri]) {
    process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri];
}

// Mock telemetry based on test configuration
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

tr.run();
