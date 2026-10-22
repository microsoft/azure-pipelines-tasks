// Test environment variable keys
export const TestEnvVars = {
    packageType: '__packageType__',
    feed: '__feed__',
    view: '__view__',
    definition: '__definition__',
    version: '__version__',
    downloadPath: '__downloadPath__',
    files: '__files__',
    extract: '__extract__',
    collectionUri: '__collectionUri__',
    agentTempDir: '__agentTempDir__',
    skipDownload: '__skipDownload__',
    retryLimit: '__retryLimit__',
    connectionShouldFail: '__connectionShouldFail__',
    downloadShouldFail: '__downloadShouldFail__',
    universalShouldFail: '__universalShouldFail__',
    resolveIdResult: '__resolveIdResult__',
    resolveVersionResult: '__resolveVersionResult__'
};

// Test data constants
export const TestData = {
    // Package IDs
    defaultPackageGuid: '6f598cbe-a5e2-4f75-aa78-e0fd08301a15',
    badZipPackageGuid: '6f598cbe-a5e2-4f75-aa78-e0fd08301a17',
    packageName: 'packageName',

    // Feed info
    defaultFeed: '/feedId',
    orgScopedFeed: 'feedId',
    projectScopedFeed: 'projectId/feedId',

    // Version
    defaultVersion: 'versionId',
    latestVersion: 'latest',
    resolvedLatestVersion: '2.0.0',

    // Paths
    defaultCollectionUri: 'https://abc.visualstudio.com/',
    agentVersion: '2.116.0',
    homeDir: '/users/test',

    // Package types
    nuget: 'nuget',
    npm: 'npm',
    maven: 'maven',
    pypi: 'pypi',
    upack: 'upack',
    cargo: 'cargo',

    // File extensions
    nugetExt: '.nupkg',
    npmExt: '.tgz',
    cargoExt: '.crate',

    // Telemetry
    telemetryArea: 'Packaging',
    telemetryFeature: 'DownloadPackagev1'
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
            [TestEnvVars.packageType]: TestData.nuget,
            [TestEnvVars.feed]: TestData.defaultFeed,
            [TestEnvVars.view]: 'viewId',
            [TestEnvVars.definition]: TestData.defaultPackageGuid,
            [TestEnvVars.version]: TestData.defaultVersion,
            [TestEnvVars.extract]: 'true',
            [TestEnvVars.collectionUri]: TestData.defaultCollectionUri,
            ...overrides
        };
    }

    /**
     * Build test environment for NuGet download with extraction
     */
    static forNuGetDownload(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.packageType]: TestData.nuget,
            [TestEnvVars.extract]: 'true',
            ...overrides
        });
    }

    /**
     * Build test environment for NuGet download without extraction
     */
    static forNuGetNoExtract(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.packageType]: TestData.nuget,
            [TestEnvVars.extract]: 'false',
            ...overrides
        });
    }

    /**
     * Build test environment for npm download
     */
    static forNpmDownload(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.packageType]: TestData.npm,
            [TestEnvVars.feed]: TestData.orgScopedFeed,
            [TestEnvVars.extract]: 'true',
            ...overrides
        });
    }

    /**
     * Build test environment for Maven download
     */
    static forMavenDownload(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.packageType]: TestData.maven,
            [TestEnvVars.feed]: TestData.orgScopedFeed,
            [TestEnvVars.files]: '*.jar; *.pom',
            ...overrides
        });
    }

    /**
     * Build test environment for Cargo download
     */
    static forCargoDownload(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.packageType]: TestData.cargo,
            [TestEnvVars.feed]: TestData.orgScopedFeed,
            [TestEnvVars.extract]: 'true',
            ...overrides
        });
    }

    /**
     * Build test environment for Universal packages (upack)
     */
    static forUniversalDownload(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.packageType]: TestData.upack,
            [TestEnvVars.feed]: TestData.orgScopedFeed,
            [TestEnvVars.files]: '**',
            ...overrides
        });
    }

    /**
     * Build test environment for project-scoped feed
     */
    static forProjectScopedFeed(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.feed]: TestData.projectScopedFeed,
            ...overrides
        });
    }

    /**
     * Build test environment for package name resolution (non-GUID definition)
     */
    static forNameResolution(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.definition]: TestData.packageName,
            ...overrides
        });
    }

    /**
     * Build test environment for latest version resolution
     */
    static forLatestVersion(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.version]: TestData.latestVersion,
            ...overrides
        });
    }

    /**
     * Build test environment for bad zip extraction failure
     */
    static forBadZip(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.definition]: TestData.badZipPackageGuid,
            [TestEnvVars.extract]: 'true',
            ...overrides
        });
    }

    /**
     * Build test environment for skip download scenario
     */
    static forSkipDownload(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.skipDownload]: 'true',
            ...overrides
        });
    }

    /**
     * Build test environment for download failure
     */
    static forDownloadError(overrides: { [key: string]: string } = {}): { [key: string]: string } {
        return this.withDefaults({
            [TestEnvVars.downloadShouldFail]: 'true',
            ...overrides
        });
    }
}
