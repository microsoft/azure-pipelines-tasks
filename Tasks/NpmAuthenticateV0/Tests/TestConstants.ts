// Test environment variable keys
export const TestEnvVars = {
    systemAccessToken: '__npmauth_systemAccessToken__',
    npmrcPath: '__npmauth_npmrcPath__',
    npmrcShouldExist: '__npmauth_npmrcShouldExist__',   // 'false' to simulate missing file
    npmrcRegistries: '__npmauth_npmrcRegistries__',      // semicolon-separated registry URLs
    localRegistries: '__npmauth_localRegistries__',      // JSON array of {url, auth} objects
    customEndpoint: '__npmauth_customEndpoint__',
    externalRegistryUrl: '__npmauth_externalRegistryUrl__',
    externalRegistryToken: '__npmauth_externalRegistryToken__',
    existingEndpoints: '__npmauth_existingEndpoints__',  // comma-separated already-seen endpoints (populates EXISTING_ENDPOINTS)
    workloadIdentityServiceConnection: '__npmauth_wifServiceConnection__',
    wifRegistryUrl: '__npmauth_wifRegistryUrl__',
    wifToken: '__npmauth_wifToken__',
    wifShouldFail: '__npmauth_wifShouldFail__',
    throwTelemetryError: '__npmauth_throwTelemetryError__',
    saveNpmrcPath: 'SAVE_NPMRC_PATH',   // pre-created dir passed to the task to skip mkdtempSync

    // Cleanup task (npmauthcleanup.js) specific vars
    cleanupNpmrcPath: '__npmcleanup_npmrcPath__',
    cleanupSaveNpmrcPath: '__npmcleanup_saveNpmrcPath__',
    cleanupIndexShouldExist: '__npmcleanup_indexShouldExist__',
    cleanupNpmrcShouldExist: '__npmcleanup_npmrcShouldExist__',
    cleanupTempDirectory: '__npmcleanup_tempDirectory__',
    cleanupTempDirExists: '__npmcleanup_tempDirExists__'
};

// Test data constants
export const TestData = {
    // Tokens
    systemAccessToken: 'test-system-access-token-12345',
    externalRegistryToken: 'external-service-token-xyz',
    wifToken: 'wif-federated-token-12345',

    // Registry URLs
    internalRegistryUrl: 'https://pkgs.dev.azure.com/testorg/_packaging/TestFeed/npm/registry/',
    externalRegistryUrl: 'https://registry.example.com/npm/',
    wifRegistryUrl: 'https://pkgs.dev.azure.com/testorg/_packaging/WifFeed/npm/registry/',

    // Service connections
    externalEndpointId: 'TestExternalEndpoint',
    wifServiceConnection: 'TestWifServiceConnection',

    // Collection URI
    collectionUri: 'https://dev.azure.com/testorg/',

    // Log prefixes used in stdout assertions
    appendPrefix: 'APPEND_TO_NPMRC:',
    telemetryPrefix: 'TELEMETRY:'
};
