// Test environment variable keys
export const TestEnvVars = {
    command: '__command__',
    arguments: '__arguments__',
    nuGetVersion: '__nuGetVersion__',
    nuGetVersionInfo: '__nuGetVersionInfo__',
    nuGetExePath: '__nuGetExePath__',
    systemAccessToken: '__systemAccessToken__',
    systemTeamFoundationCollectionUri: '__systemTeamFoundationCollectionUri__',
    systemDebug: '__systemDebug__',
    getNuGetShouldFail: '__getNuGetShouldFail__',
    packagingLocationShouldFail: '__packagingLocationShouldFail__',
    nuGetExitCode: '__nuGetExitCode__',
    extraUrlPrefixes: '__extraUrlPrefixes__'
};

// Test data constants
export const TestData = {
    // NuGet paths
    defaultNuGetPath: 'c:\\from\\tool\\installer\\nuget.exe',
    envNuGetPath: 'c:\\from\\env\\nuget.exe',
    
    // NuGet versions
    defaultVersion: '3.5.0',
    defaultVersionInfo: [3, 5, 0, 1500],
    oldVersion: '3.2.0',
    oldVersionInfo: [3, 2, 0, 0],
    newVersion: '6.0.0',
    newVersionInfo: [6, 0, 0, 0],
    
    // Authentication
    defaultAccessToken: 'test-access-token-12345',
    defaultServiceUri: 'https://example.visualstudio.com/defaultcollection',
    defaultCollectionUri: 'https://example.visualstudio.com/defaultcollection',
    
    // Agent paths
    agentHomeDir: 'c:\\agent\\home\\directory',
    buildSourceDir: 'c:\\agent\\home\\directory\\sources',
    credProviderPath: 'c:\\agent\\home\\directory\\externals\\nuget\\CredentialProvider',
    
    // NuGet command outputs
    restoreOutput: 'NuGet restore completed successfully',
    pushOutput: 'Your package was pushed.',
    defaultOutput: 'NuGet output here',

    // Telemetry
    telemetryArea: 'Packaging',
    telemetryFeature: 'NuGetV0'
};

/**
 * Test data builder for creating common test configurations
 */
export class TestDataBuilder {
    /**
     * Build test environment with common defaults and optional overrides
     */
    static withDefaults(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return {
            [TestEnvVars.command]: 'testCommand',
            [TestEnvVars.arguments]: 'testArgument',
            [TestEnvVars.nuGetVersion]: TestData.defaultVersion,
            [TestEnvVars.nuGetVersionInfo]: JSON.stringify(TestData.defaultVersionInfo),
            [TestEnvVars.systemAccessToken]: TestData.defaultAccessToken,
            [TestEnvVars.systemTeamFoundationCollectionUri]: TestData.defaultCollectionUri,
            [TestEnvVars.nuGetExitCode]: '0',
            ...overrides
        };
    }

    /**
     * Build test environment for restore command scenario
     */
    static forRestoreCommand(args: string = '', overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.command]: 'restore',
            [TestEnvVars.arguments]: args,
            ...overrides
        });
    }

    /**
     * Build test environment for push command scenario
     */
    static forPushCommand(args: string = '', overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.command]: 'push',
            [TestEnvVars.arguments]: args,
            ...overrides
        });
    }

    /**
     * Build test environment for old NuGet version scenario (below 3.5.0)
     */
    static forOldVersion(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.nuGetVersion]: TestData.oldVersion,
            [TestEnvVars.nuGetVersionInfo]: JSON.stringify(TestData.oldVersionInfo),
            ...overrides
        });
    }

    /**
     * Build test environment for using NuGet from environment variable
     */
    static forEnvPath(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.nuGetExePath]: TestData.envNuGetPath,
            ...overrides
        });
    }

    /**
     * Build test environment for NuGet tool getter failure
     */
    static forGetNuGetFailure(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.getNuGetShouldFail]: 'true',
            ...overrides
        });
    }

    /**
     * Build test environment for packaging location failure
     */
    static forPackagingLocationFailure(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.packagingLocationShouldFail]: 'true',
            ...overrides
        });
    }

    /**
     * Build test environment for NuGet execution failure (nonzero exit code)
     */
    static forExecutionFailure(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.nuGetExitCode]: '1',
            ...overrides
        });
    }

    /**
     * Build test environment with extra URL prefixes for proxy testing
     */
    static forExtraUrlPrefixes(prefixes: string, overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.extraUrlPrefixes]: prefixes,
            ...overrides
        });
    }
}
