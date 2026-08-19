// Test environment variable keys
export const TestEnvVars = {
    versionSpec: '__versionSpec__',
    checkLatest: '__checkLatest__',
    getNuGetShouldFail: '__getNuGetShouldFail__',
    getNuGetFailMessage: '__getNuGetFailMessage__',
    resolveVersionResult: '__resolveVersionResult__',
    msBuildVersion: '__msBuildVersion__',
    nuGetVersion: '__nuGetVersion__',
    nuGetVersionInfo: '__nuGetVersionInfo__',
    throwTelemetryError: '__throwTelemetryError__',
    nullVersionInfo: '__nullVersionInfo__',
    resolveVersionShouldFail: '__resolveVersionShouldFail__'
};

// Test data constants
export const TestData = {
    // NuGet paths
    defaultNuGetPath: 'c:\\from\\tool\\installer\\nuget.exe',

    // NuGet versions
    defaultVersionSpec: '4.9.6',
    resolvedVersionSpec: '5.0.0',
    explicitVersionSpec: '5.11.0',
    defaultNuGetVersion: '4.9.6.0',
    defaultNuGetVersionInfo: [4, 9, 6, 0],

    // MSBuild versions
    defaultMSBuildVersion: '16.0.0',

    // Telemetry
    telemetryArea: 'Packaging',
    telemetryFeature: 'NuGetToolInstaller',

    // Environment variable name
    nuGetExeToolPathEnvVar: 'NUGET_EXE_TOOL_PATH'
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
            [TestEnvVars.versionSpec]: TestData.defaultVersionSpec,
            [TestEnvVars.checkLatest]: 'false',
            [TestEnvVars.nuGetVersion]: TestData.defaultNuGetVersion,
            [TestEnvVars.nuGetVersionInfo]: JSON.stringify(TestData.defaultNuGetVersionInfo),
            ...overrides
        };
    }

    /**
     * Build test environment for explicit version spec
     */
    static forExplicitVersion(versionSpec: string, overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.versionSpec]: versionSpec,
            ...overrides
        });
    }

    /**
     * Build test environment for no version spec (resolve default)
     */
    static forDefaultVersion(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return {
            [TestEnvVars.checkLatest]: 'false',
            [TestEnvVars.resolveVersionResult]: TestData.resolvedVersionSpec,
            [TestEnvVars.msBuildVersion]: TestData.defaultMSBuildVersion,
            [TestEnvVars.nuGetVersion]: TestData.defaultNuGetVersion,
            [TestEnvVars.nuGetVersionInfo]: JSON.stringify(TestData.defaultNuGetVersionInfo),
            ...overrides
        };
    }

    /**
     * Build test environment for checkLatest enabled
     */
    static forCheckLatest(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.checkLatest]: 'true',
            ...overrides
        });
    }

    /**
     * Build test environment for getNuGet failure
     */
    static forGetNuGetFailure(errorMessage: string = 'Failed to download NuGet', overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.getNuGetShouldFail]: 'true',
            [TestEnvVars.getNuGetFailMessage]: errorMessage,
            ...overrides
        });
    }

    /**
     * Build test environment for telemetry error
     */
    static forTelemetryError(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.throwTelemetryError]: 'true',
            ...overrides
        });
    }

    /**
     * Build test environment for null version info from PE parser
     */
    static forNullVersionInfo(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.nullVersionInfo]: 'true',
            ...overrides
        });
    }

    /**
     * Build test environment for resolveNuGetVersion failure
     */
    static forResolveVersionFailure(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return {
            [TestEnvVars.checkLatest]: 'false',
            [TestEnvVars.resolveVersionShouldFail]: 'true',
            [TestEnvVars.nuGetVersion]: TestData.defaultNuGetVersion,
            [TestEnvVars.nuGetVersionInfo]: JSON.stringify(TestData.defaultNuGetVersionInfo),
            ...overrides
        };
    }
}
