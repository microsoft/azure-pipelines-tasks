// Test environment variable keys
export const TestEnvVars = {
    systemAccessToken: '__systemAccessToken__',
    systemTeamFoundationCollectionUri: '__systemTeamFoundationCollectionUri__',
    systemDebug: '__systemDebug__',
    artifactFeed: '__artifactFeed__',
    externalEndpoints: '__externalEndpoints__',
    workloadIdentityServiceConnection: '__workloadIdentityServiceConnection__',
    feedUrl: '__feedUrl__',
    wifToken: '__wifToken__',
    wifShouldFail: '__wifShouldFail__',
    // Enhanced test configuration flags
    throwTelemetryError: '__throwTelemetryError__',
    simulateAuthFailure: '__simulateAuthFailure__'
};

// Test data constants
export const TestData = {
    // Access tokens
    defaultAccessToken: 'test-access-token-12345',
    secretToken: 'secret-token-should-be-masked',
    emptyToken: '',
    specialCharsToken: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`',
    longToken: 'a'.repeat(2048),
    adoHostedToken: 'ado-hosted-token',
    wifToken: 'wif-federated-token-12345',
    
    // Feed names
    singleFeed: 'TestFeed',
    feedWithDot: 'Test.Feed',
    projectScopedFeed: 'MyProject/TestFeed',
    duplicateFeed: 'DuplicateFeed',
   
    // Collection URIs
    defaultCollectionUri: 'https://dev.azure.com/testorg/',
    adoHostedUri: 'https://dev.azure.com/myorg/',
    
    // Feed URLs
    defaultFeedUrl: 'https://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/upload/',
    wifFeedUrl: 'https://pkgs.dev.azure.com/testorg/_packaging/WifFeed/pypi/upload/',
    
    // Environment variable names
    pypircPathVar: 'PYPIRC_PATH',
    
    // Expected output strings
    telemetryArea: 'Packaging',
    telemetryFeature: 'TwineAuthenticateV1',
    
    // Service endpoints
    externalServiceEndpoint: 'TestExternalEndpoint',
    wifServiceConnection: 'TestWifServiceConnection',
    
    // Pypirc content sections
    pypircDistutils: '[distutils]',
    pypircIndexServers: 'index-servers=',
    pypircRepository: 'repository=',
    pypircUsername: 'username=',
    pypircPassword: 'password='
};

/**
 * Test data builder for creating common test configurations
 * Provides declarative, self-documenting test setup
 */
export class TestDataBuilder {
    /**
     * Build test environment with common defaults and optional overrides
     * @param overrides Environment variables to override defaults
     * @returns Environment variable object for test setup
     */
    static withDefaults(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return {
            [TestEnvVars.systemAccessToken]: TestData.defaultAccessToken,
            [TestEnvVars.systemTeamFoundationCollectionUri]: TestData.defaultCollectionUri,
            ...overrides
        };
    }

    /**
     * Build test environment for internal feed authentication
     * @param feedName Name of the feed to authenticate (default: TestFeed)
     * @param overrides Additional environment variables
     */
    static forInternalAuth(feedName: string = TestData.singleFeed, overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.artifactFeed]: feedName,
            ...overrides
        });
    }

    /**
     * Build test environment for WIF authentication
     * @param overrides Additional environment variables
     */
    static forWifAuth(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.feedUrl]: TestData.wifFeedUrl,
            [TestEnvVars.workloadIdentityServiceConnection]: TestData.wifServiceConnection,
            [TestEnvVars.wifToken]: TestData.wifToken,
            ...overrides
        });
    }

    /**
     * Build test environment for WIF authentication that should fail
     * @param overrides Additional environment variables
     */
    static forWifFailure(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.feedUrl]: TestData.wifFeedUrl,
            [TestEnvVars.workloadIdentityServiceConnection]: TestData.wifServiceConnection,
            [TestEnvVars.wifShouldFail]: 'true',
            ...overrides
        });
    }

    /**
     * Build test environment with external service endpoints
     * @param endpoints External endpoint names
     * @param overrides Additional environment variables
     */
    static withExternalEndpoints(endpoints: string | string[], overrides: { [key: string]: string } = {}): { [key: string]: string } {
        const endpointString = Array.isArray(endpoints) ? endpoints.join(',') : endpoints;
        return this.withDefaults({
            [TestEnvVars.externalEndpoints]: endpointString,
            ...overrides
        });
    }

    /**
     * Build test environment for authentication failure simulation
     * @param overrides Additional environment variables
     */
    static forAuthFailure(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.simulateAuthFailure]: 'true',
            ...overrides
        });
    }

    /**
     * Build test environment for telemetry error simulation
     * @param feedName Name of the feed to authenticate
     * @param overrides Additional environment variables
     */
    static forTelemetryError(feedName: string = TestData.singleFeed, overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.forInternalAuth(feedName, {
            [TestEnvVars.throwTelemetryError]: 'true',
            ...overrides
        });
    }
}
