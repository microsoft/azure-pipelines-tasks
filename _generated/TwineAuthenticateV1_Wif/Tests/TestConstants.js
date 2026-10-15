"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestDataBuilder = exports.TestData = exports.TestEnvVars = void 0;
// Test environment variable keys
exports.TestEnvVars = {
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
exports.TestData = {
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
    externalEndpointToken: 'external-test-token-abc123',
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
class TestDataBuilder {
    /**
     * Build test environment with common defaults and optional overrides
     * @param overrides Environment variables to override defaults
     * @returns Environment variable object for test setup
     */
    static withDefaults(overrides = {}) {
        return Object.assign({ [exports.TestEnvVars.systemAccessToken]: exports.TestData.defaultAccessToken, [exports.TestEnvVars.systemTeamFoundationCollectionUri]: exports.TestData.defaultCollectionUri }, overrides);
    }
    /**
     * Build test environment for internal feed authentication
     * @param feedName Name of the feed to authenticate (default: TestFeed)
     * @param overrides Additional environment variables
     */
    static forInternalAuth(feedName = exports.TestData.singleFeed, overrides = {}) {
        return this.withDefaults(Object.assign({ [exports.TestEnvVars.artifactFeed]: feedName }, overrides));
    }
    /**
     * Build test environment for WIF authentication
     * @param overrides Additional environment variables
     */
    static forWifAuth(overrides = {}) {
        return this.withDefaults(Object.assign({ [exports.TestEnvVars.feedUrl]: exports.TestData.wifFeedUrl, [exports.TestEnvVars.workloadIdentityServiceConnection]: exports.TestData.wifServiceConnection, [exports.TestEnvVars.wifToken]: exports.TestData.wifToken }, overrides));
    }
    /**
     * Build test environment for WIF authentication that should fail
     * @param overrides Additional environment variables
     */
    static forWifFailure(overrides = {}) {
        return this.withDefaults(Object.assign({ [exports.TestEnvVars.feedUrl]: exports.TestData.wifFeedUrl, [exports.TestEnvVars.workloadIdentityServiceConnection]: exports.TestData.wifServiceConnection, [exports.TestEnvVars.wifShouldFail]: 'true' }, overrides));
    }
    /**
     * Build test environment with external service endpoints
     * @param endpoints External endpoint names
     * @param overrides Additional environment variables
     */
    static withExternalEndpoints(endpoints, overrides = {}) {
        const endpointString = Array.isArray(endpoints) ? endpoints.join(',') : endpoints;
        return this.withDefaults(Object.assign({ [exports.TestEnvVars.externalEndpoints]: endpointString }, overrides));
    }
    /**
     * Build test environment for authentication failure simulation
     * @param overrides Additional environment variables
     */
    static forAuthFailure(overrides = {}) {
        return this.withDefaults(Object.assign({ [exports.TestEnvVars.simulateAuthFailure]: 'true' }, overrides));
    }
    /**
     * Build test environment for telemetry error simulation
     * @param feedName Name of the feed to authenticate
     * @param overrides Additional environment variables
     */
    static forTelemetryError(feedName = exports.TestData.singleFeed, overrides = {}) {
        return this.forInternalAuth(feedName, Object.assign({ [exports.TestEnvVars.throwTelemetryError]: 'true' }, overrides));
    }
}
exports.TestDataBuilder = TestDataBuilder;
