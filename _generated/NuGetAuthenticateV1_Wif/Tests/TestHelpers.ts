import * as testConstants from './TestConstants';

export class TestHelpers {
    /**
     * Clear all test environment variables before each test
     */
    static beforeEach(): void {
        // Clear all test configuration environment variables
        Object.values(testConstants.TestEnvVars).forEach(envVar => {
            delete process.env[envVar];
        });
        
        // Clear mock control flags
        delete process.env['__throwTelemetryError__'];
        delete process.env['__mockServiceConnections__'];
    }

    /**
     * Clean up actual environment variables after each test
     */
    static afterEach(): void {
        // Clean up actual environment variables that might be set by the task
        delete process.env['VSS_NUGET_EXTERNAL_FEED_ENDPOINTS'];
        delete process.env['VSS_NUGET_URI_PREFIXES'];
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['SYSTEM_DEBUG'];
        delete process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'];
        delete process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'];
    }

    /**
     * Setup basic successful authentication scenario
     */
    static setupBasicAuth(): void {
        process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
        process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
    }

    /**
     * Setup WIF authentication scenario
     */
    static setupWifAuth(feedUrl?: string): void {
        process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
        process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
        if (feedUrl) {
            process.env[testConstants.TestEnvVars.feedUrl] = feedUrl;
        }
    }

    /**
     * Setup external service connections
     */
    static setupExternalServiceConnections(connections: any[]): void {
        process.env['__mockServiceConnections__'] = JSON.stringify(connections);
    }
}
