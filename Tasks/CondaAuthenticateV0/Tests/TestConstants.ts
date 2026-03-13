// Test environment variable keys
export const TestEnvVars = {
    systemAccessToken: '__systemAccessToken__',
    systemTeamFoundationCollectionUri: '__systemTeamFoundationCollectionUri__',
    systemDebug: '__systemDebug__',
    workloadIdentityServiceConnection: '__workloadIdentityServiceConnection__',
    wifToken: '__wifToken__',
    wifShouldFail: '__wifShouldFail__'
};

// Test data constants
export const TestData = {
    defaultAccessToken: 'test-access-token-12345',
    secretToken: 'secret-token-should-be-masked',
    emptyToken: '',
    specialCharsToken: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`',
    longToken: 'a'.repeat(2048),
    adoHostedToken: 'ado-hosted-token',
    tfsOnPremToken: 'tfs-onprem-token',
    customCollectionToken: 'custom-collection-token',
    telemetryToken: 'test-token-for-telemetry',
    debugToken: 'debug-test-token',
    wifToken: 'wif-federated-token-12345',
    wifServiceConnection: 'TestWifServiceConnection',
    
    // Collection URIs
    defaultCollectionUri: 'https://dev.azure.com/testorg/',
    adoHostedUri: 'https://dev.azure.com/myorg/',
    tfsOnPremUri: 'https://tfs.company.com/DefaultCollection/',
    customCollectionUri: 'https://custom-azdo.company.com/CustomCollection/',
    
    // Expected output strings
    expectedEnvVar: 'ARTIFACTS_CONDA_TOKEN',
    telemetryArea: 'Packaging',
    telemetryFeature: 'CondaAuthenticateV0'
};
