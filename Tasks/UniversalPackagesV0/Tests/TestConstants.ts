// Test environment variable keys
export const TestEnvVars = {
    command: '__command__',
    downloadDirectory: '__downloadDirectory__',
    publishDirectory: '__publishDirectory__',
    feedsToUse: '__feedsToUse__',
    feedListDownload: '__feedListDownload__',
    packageListDownload: '__packageListDownload__',
    versionListDownload: '__versionListDownload__',
    artifactToolPath: '__artifactToolPath__',
    mockExitCode: '__mockExitCode__',
    mockStdout: '__mockStdout__',
    mockStderr: '__mockStderr__',
    // Pre-job specific
    serverType: '__serverType__',
    cachedArtifactToolPath: '__cachedArtifactToolPath__',
    shouldFailInstall: '__shouldFailInstall__',
};

// Test data constants
export const TestData = {
    // Artifact tool
    artifactToolCmd: 'c:\\mock\\location\\ArtifactTool.exe',
    defaultArtifactToolPath: 'c:\\mock\\location\\ArtifactTool.exe',

    // Service connection
    defaultServiceUri: 'https://example.visualstudio.com/defaultcollection',
    defaultAccessToken: 'token',

    // Download defaults
    defaultDownloadDir: 'c:\\temp',
    defaultFeed: 'TestFeed',
    defaultPackage: 'TestPackage',
    defaultVersion: '1.0.0',

    // Error messages
    failedToGetArtifactTool: 'Failed to get artifact tool.',
    artifactToolPathNotSet: 'Artifact tool path was not set by pre-job execution.',
    packagesFailedToDownload: 'Packages failed to download',
    universalPackagesNotSupportedOnPrem: 'Universal Packages are not supported in Azure DevOps Server.',
};
