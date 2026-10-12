"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestDataBuilder = exports.TestData = exports.TestEnvVars = void 0;
// Test environment variable keys
exports.TestEnvVars = {
    systemAccessToken: '__systemAccessToken__',
    systemTeamFoundationCollectionUri: '__systemTeamFoundationCollectionUri__',
    systemDebug: '__systemDebug__',
    workloadIdentityServiceConnection: '__workloadIdentityServiceConnection__',
    wifToken: '__wifToken__',
    wifShouldFail: '__wifShouldFail__',
    configFilePath: '__configFilePath__',
    registryNames: '__registryNames__',
    cargoServiceConnections: '__cargoServiceConnections__'
};
// Test data constants
exports.TestData = {
    // Tokens
    defaultAccessToken: 'test-access-token-12345',
    secretToken: 'secret-token-should-be-masked',
    emptyToken: '',
    specialCharsToken: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`',
    longToken: 'a'.repeat(2048),
    wifToken: 'wif-federated-token-12345',
    wifServiceConnection: 'TestWifServiceConnection',
    // Collection URIs
    defaultCollectionUri: 'https://dev.azure.com/testorg/',
    adoHostedUri: 'https://pkgs.dev.azure.com/myorg/',
    // Registry names
    testRegistry: 'test-registry',
    multipleRegistries: 'test-registry,another-registry',
    // Config file paths
    validConfigFile: 'valid-config.toml',
    missingConfigFile: 'missing-config.toml',
    invalidConfigFile: 'invalid-config.toml',
    // Environment variable names
    expectedTokenVar: 'CARGO_REGISTRIES_TEST_REGISTRY_TOKEN',
    expectedCredProviderVar: 'CARGO_REGISTRIES_TEST_REGISTRY_CREDENTIAL_PROVIDER',
    expectedCratesIoToken: 'CARGO_REGISTRY_TOKEN',
    expectedCratesIoCredProvider: 'CARGO_REGISTRY_CREDENTIAL_PROVIDER',
    // Telemetry
    telemetryArea: 'Packaging',
    telemetryFeature: 'CargoAuthenticateV0',
    // Valid TOML config content
    validTomlContent: `
[registries]
test-registry = { index = "sparse+https://pkgs.dev.azure.com/testorg/_packaging/test-feed/Cargo/index/" }
`,
    multiRegistryTomlContent: `
[registries]
test-registry = { index = "sparse+https://pkgs.dev.azure.com/testorg/_packaging/test-feed/Cargo/index/" }
another-registry = { index = "sparse+https://pkgs.dev.azure.com/testorg/_packaging/another-feed/Cargo/index/" }
`,
    alternateTomlFormat: `
[registries.test-registry]
index = "sparse+https://pkgs.dev.azure.com/testorg/_packaging/test-feed/Cargo/index/"
`,
    missingRegistryToml: `
[dependencies]
serde = "1.0"
`,
    invalidToml: `
[registries
test-registry = { index = "invalid
`,
    cratesIoToml: `
[registries]
crates-io = { index = "sparse+https://crates.io/api/v1/crates" }
`,
    externalRegistryToml: `
[registries]
external-registry = { index = "sparse+https://external-server.com/api/v1/crates" }
`,
    // External service connection registries
    externalAzureDevOpsToml: `
[registries]
test-registry = { index = "sparse+https://pkgs.dev.azure.com/externalorg/_packaging/external-feed/Cargo/index/" }
`,
    // Mixed internal and external registries
    mixedRegistriesToml: `
[registries]
internal-registry = { index = "sparse+https://pkgs.dev.azure.com/testorg/_packaging/internal-feed/Cargo/index/" }
external-registry = { index = "sparse+https://pkgs.dev.azure.com/externalorg/_packaging/external-feed/Cargo/index/" }
`,
    // Registries with already-set env vars
    preAuthenticatedToml: `
[registries]
test-registry = { index = "sparse+https://pkgs.dev.azure.com/testorg/_packaging/test-feed/Cargo/index/" }
`,
    // Service connection mock data
    externalServiceConnectionToken: 'external-connection-token-67890',
    cratesIoToken: 'crates-io-api-token-abcdef',
    externalOrgUri: 'https://pkgs.dev.azure.com/externalorg/',
    // Invalid URLs for testing
    invalidUrlToml: `
[registries]
test-registry = { index = "not-a-valid-url" }
`,
    emptyRegistryNameToml: `
[registries]
"" = { index = "sparse+https://pkgs.dev.azure.com/testorg/_packaging/test-feed/Cargo/index/" }
`
};
/**
 * Test data builder for creating common test configurations
 */
class TestDataBuilder {
    /**
     * Build test environment with common defaults and optional overrides
     * @param overrides Environment variables to override defaults
     * @returns Environment variable object for test setup
     */
    static withDefaults(overrides = {}) {
        return Object.assign({ [exports.TestEnvVars.systemAccessToken]: exports.TestData.defaultAccessToken, [exports.TestEnvVars.systemTeamFoundationCollectionUri]: exports.TestData.defaultCollectionUri, [exports.TestEnvVars.configFilePath]: exports.TestData.validConfigFile, '__mockConfigContent__': exports.TestData.validTomlContent }, overrides);
    }
    /**
     * Build test environment for internal authentication scenarios
     * Internal auth uses System.AccessToken and processes all registries from config
     * @param registryName Name of the registry to authenticate
     * @param overrides Additional environment variables
     */
    static forInternalAuth(registryName = 'test-registry', overrides = {}) {
        return this.withDefaults(Object.assign({ '__mockConfigContent__': this.buildTomlConfig([registryName], 'testorg') }, overrides));
    }
    /**
     * Build test environment for external authentication scenarios
     * @param registryName Name of the registry to authenticate
     * @param serviceConnection Service connection name
     * @param overrides Additional environment variables
     */
    static forExternalAuth(registryName = 'test-registry', serviceConnection = 'ExternalConnection', overrides = {}) {
        const feedName = 'external-feed';
        const org = 'externalorg';
        return this.withDefaults(Object.assign({ [exports.TestEnvVars.cargoServiceConnections]: serviceConnection, '__mockServiceConnections__': JSON.stringify([{
                    authType: 'UsernamePassword',
                    packageSource: {
                        uri: `https://pkgs.dev.azure.com/${org}/_packaging/${feedName}/Cargo/index/`
                    },
                    username: org,
                    password: exports.TestData.externalServiceConnectionToken
                }]), '__mockConfigContent__': `[registries]\n${registryName} = { index = "sparse+https://pkgs.dev.azure.com/${org}/_packaging/${feedName}/Cargo/index/" }\n` }, overrides));
    }
    /**
     * Build test environment for WIF (Workload Identity Federation) scenarios
     * @param registryName Name of the registry to authenticate
     * @param overrides Additional environment variables
     */
    static forWifAuth(registryName = 'test-registry', overrides = {}) {
        return Object.assign({ [exports.TestEnvVars.workloadIdentityServiceConnection]: exports.TestData.wifServiceConnection, [exports.TestEnvVars.wifToken]: exports.TestData.wifToken, [exports.TestEnvVars.systemTeamFoundationCollectionUri]: exports.TestData.defaultCollectionUri, [exports.TestEnvVars.configFilePath]: exports.TestData.validConfigFile, '__mockConfigContent__': this.buildTomlConfig([registryName], 'testorg') }, overrides);
    }
    /**
     * Build test environment for crates.io token authentication
     * @param overrides Additional environment variables
     */
    static forCratesIoAuth(overrides = {}) {
        return this.withDefaults(Object.assign({ [exports.TestEnvVars.cargoServiceConnections]: 'CratesIoConnection', '__mockServiceConnections__': JSON.stringify([{
                    authType: 'Token',
                    packageSource: {
                        uri: 'https://crates.io'
                    },
                    token: exports.TestData.cratesIoToken
                }]), '__mockConfigContent__': exports.TestData.cratesIoToml }, overrides));
    }
    /**
     * Build test environment for mixed authentication scenarios
     * @param internalRegistry Internal registry name
     * @param externalRegistry External registry name
     * @param serviceConnection External service connection name
     * @param overrides Additional environment variables
     */
    static forMixedAuth(internalRegistry = 'internal-registry', externalRegistry = 'external-registry', serviceConnection = 'ExternalConnection', overrides = {}) {
        return this.withDefaults(Object.assign({ [exports.TestEnvVars.cargoServiceConnections]: serviceConnection, '__mockServiceConnections__': JSON.stringify([{
                    authType: 'UsernamePassword',
                    packageSource: {
                        uri: 'https://pkgs.dev.azure.com/externalorg/_packaging/external-feed/Cargo/index/'
                    },
                    username: 'externalorg',
                    password: exports.TestData.externalServiceConnectionToken
                }]), '__mockConfigContent__': exports.TestData.mixedRegistriesToml }, overrides));
    }
    /**
     * Build a TOML config with specific registries
     * @param registries Array of registry names
     * @param org Organization name
     * @returns TOML configuration string
     */
    static buildTomlConfig(registries, org = 'testorg') {
        const registryConfigs = registries.map(name => `${name} = { index = "sparse+https://pkgs.dev.azure.com/${org}/_packaging/${name}-feed/Cargo/index/" }`).join('\n');
        return `[registries]\n${registryConfigs}\n`;
    }
    /**
     * Build a TOML config with alternate format (explicit sections)
     * @param registries Array of registry names
     * @param org Organization name
     * @returns TOML configuration string
     */
    static buildTomlConfigAlternateFormat(registries, org = 'testorg') {
        const registryConfigs = registries.map(name => `[registries.${name}]\nindex = "sparse+https://pkgs.dev.azure.com/${org}/_packaging/${name}-feed/Cargo/index/"`).join('\n\n');
        return `${registryConfigs}\n`;
    }
    /**
     * Build telemetry data for validation
     * @param additionalData Additional telemetry properties
     * @returns Telemetry data object
     */
    static buildTelemetryData(additionalData = {}) {
        return Object.assign({ InternalFeedAuthCount: 0, ExternalFeedAuthCount: 0, CratesIoAuthCount: 0 }, additionalData);
    }
}
exports.TestDataBuilder = TestDataBuilder;
