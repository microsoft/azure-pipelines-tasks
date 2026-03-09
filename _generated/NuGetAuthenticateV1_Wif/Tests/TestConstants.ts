// Test environment variable keys
export const TestEnvVars = {
    systemAccessToken: '__systemAccessToken__',
    systemTeamFoundationCollectionUri: '__systemTeamFoundationCollectionUri__',
    systemDebug: '__systemDebug__',
    forceReinstallCredentialProvider: '__forceReinstallCredentialProvider__',
    nuGetServiceConnections: '__nuGetServiceConnections__',
    workloadIdentityServiceConnection: '__workloadIdentityServiceConnection__',
    feedUrl: '__feedUrl__',
    wifToken: '__wifToken__',
    wifShouldFail: '__wifShouldFail__',
    credProviderInstalled: '__credProviderInstalled__',
    credProviderShouldFail: '__credProviderShouldFail__'
};

// Test data constants
export const TestData = {
    // Tokens
    defaultAccessToken: 'test-access-token-12345',
    secretToken: 'secret-token-should-be-masked',
    emptyToken: '',
    specialCharsToken: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`',
    longToken: 'a'.repeat(2048),
    wifToken: 'wif-federated-token-12345',
    externalServiceConnectionToken: 'external-connection-token-67890',
    
    // Service connection names
    wifServiceConnection: 'TestWifServiceConnection',
    wifServiceConnectionAlias: 'TestAzureDevOpsServiceConnection',
    
    // Collection URIs
    defaultCollectionUri: 'https://dev.azure.com/testorg/',
    visualStudioUri: 'https://testorg.visualstudio.com/',
    onPremUri: 'https://azdo.company.com/DefaultCollection/',
    
    // Valid feed URLs (for isValidFeed tests)
    validFeedUrls: {
        devAzure: 'https://pkgs.dev.azure.com/testorg/_packaging/test-feed/nuget/v3/index.json',
        devAzureWithProject: 'https://pkgs.dev.azure.com/testorg/testproject/_packaging/test-feed/nuget/v3/index.json',
        visualStudio: 'https://testorg.visualstudio.com/_packaging/test-feed/nuget/v3/index.json',
        vstsMe: 'https://testorg.vsts.me/_packaging/test-feed/nuget/v3/index.json',
        codedevMs: 'https://testorg.codedev.ms/_packaging/test-feed/nuget/v3/index.json',
        devppeAzure: 'https://pkgs.devppe.azure.com/testorg/_packaging/test-feed/nuget/v3/index.json',
        codeappMs: 'https://testorg.codeapp.ms/_packaging/test-feed/nuget/v3/index.json',
        trailingSlash: 'https://pkgs.dev.azure.com/testorg/_packaging/test-feed/nuget/v3/index.json/',
        uppercase: 'HTTPS://PKGS.DEV.AZURE.COM/TESTORG/_PACKAGING/TEST-FEED/NUGET/V3/INDEX.JSON',
        withSubdomain: 'https://company.pkgs.dev.azure.com/testorg/_packaging/test-feed/nuget/v3/index.json'
    },
    
    // Invalid feed URLs
    invalidFeedUrls: {
        nugetOrg: 'https://api.nuget.org/v3/index.json',
        github: 'https://nuget.pkg.github.com/testorg/index.json',
        customDomain: 'https://custom-nuget.company.com/v3/index.json',
        missingIndexJson: 'https://pkgs.dev.azure.com/testorg/_packaging/test-feed/nuget/v3/',
        wrongProtocol: 'http://pkgs.dev.azure.com/testorg/_packaging/test-feed/nuget/v3/index.json',
        malformed: 'not-a-url',
        withQueryParams: 'https://pkgs.dev.azure.com/testorg/_packaging/test-feed/nuget/v3/index.json?api-version=1.0',
        missingPackaging: 'https://pkgs.dev.azure.com/testorg/test-feed/nuget/v3/index.json'
    },
    
    // Edge case feed URLs
    edgeCaseFeedUrls: {
        smartQuotesSingle: '\u2018https://pkgs.dev.azure.com/testorg/_packaging/test-feed/nuget/v3/index.json\u2019',
        smartQuotesDouble: '\u201Chttps://pkgs.dev.azure.com/testorg/_packaging/test-feed/nuget/v3/index.json\u201D',
        leadingWhitespace: '   https://pkgs.dev.azure.com/testorg/_packaging/test-feed/nuget/v3/index.json',
        trailingWhitespace: 'https://pkgs.dev.azure.com/testorg/_packaging/test-feed/nuget/v3/index.json   ',
        bothWhitespace: '  https://pkgs.dev.azure.com/testorg/_packaging/test-feed/nuget/v3/index.json  ',
        regularQuotes: '"https://pkgs.dev.azure.com/testorg/_packaging/test-feed/nuget/v3/index.json"',
        mixedQuotes: '\u2018https://pkgs.dev.azure.com/testorg/_packaging/test-feed/nuget/v3/index.json\u201D'
    },
    
    // Cross-org feed URL (for WIF testing)
    crossOrgFeedUrl: 'https://pkgs.dev.azure.com/externalorg/_packaging/external-feed/nuget/v3/index.json',
    
    // Service connection mock data
    externalServiceConnection: {
        authType: 'UsernamePassword',
        packageSource: {
            uri: 'https://pkgs.dev.azure.com/externalorg/_packaging/external-feed/nuget/v3/index.json'
        },
        username: 'externalorg',
        password: 'external-connection-token-67890'
    },
    
    tokenServiceConnection: {
        authType: 'Token',
        packageSource: {
            uri: 'https://api.nuget.org/v3/index.json'
        },
        token: 'nuget-org-token-abcdef'
    },
    
    // Telemetry
    telemetryArea: 'Packaging',
    telemetryFeature: 'NuGetAuthenticateV1',
    
    // Expected environment variable names
    expectedCredProviderEnvVar: 'VSS_NUGET_EXTERNAL_FEED_ENDPOINTS'
};
