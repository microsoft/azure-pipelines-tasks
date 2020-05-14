// general constants
export const toolFolderName = 'VsTest';
export const downloadPath = 'downloadPath';
export const defaultUsername = 'vstestPlatformToolInstaller';
export const vsTestToolsInstallerInstalledToolLocation = 'VsTestToolsInstallerInstalledToolLocation';

// agent related constants
export const agentTempDirectory = 'Agent.TempDirectory';
export const agentWorkFolder = 'Agent.WorkFolder';

// external constants
export const packageId = 'Microsoft.TestPlatform';
export const defaultPackageSource = 'https://api.nuget.org/v3/index.json';

// nuget exe parameters
export const list = 'list';
export const basic = 'basic';
export const install = 'install';
export const sources = 'sources';
export const add = 'Add';
export const noninteractive = '-NonInteractive';
export const name = '-Name';
export const source = '-Source';
export const version = '-Version';
export const noCache = '-NoCache';
export const usernameParam = '-Username';
export const passwordParam = '-Password';
export const configFile = '-ConfigFile';
export const preRelease = '-PreRelease';
export const directDownload = '-DirectDownload';
export const outputDirectory = '-OutputDirectory';
export const validAuthenticationTypes = '-ValidAuthenticationTypes';

// input fields
export const netShare = 'netShare';
export const username = 'username';
export const password = 'password';
export const versionSelector = 'versionSelector';
export const packageFeedSelector = 'packageFeedSelector';
export const testPlatformVersion = 'testPlatformVersion';

// input values
export const nugetOrg = 'nugetOrg';
export const customFeed = 'customFeed';
export const latestStable = 'lateststable';
export const specificVersion = 'specificversion';
export const latestPrerelease = 'latestprerelease';

// CI related constants
export const unsupportedOS = 'unsupportedOS';
export const listingFailed = 'listingFailed';
export const installationStatusFailed = 'failed';
export const installationStatusSucceeded = 'succeeded';
export const downloadFailed = 'downloadFailed';
export const notExplicitVersion = 'notExplicitVersion';
export const configFileWriteFailed = 'configFileWriteFailed';
export const packageFileDoesNotExist = 'packageFileDoesNotExist';
export const unexpectedPackageFileName = 'unexpectedPackageFileName';

// Regexes
export const versionExtractionRegex = /microsoft\.testplatform\.(.*)\.nupkg/i;

// Long constants
export const emptyNugetConfig = `<?xml version="1.0" encoding="utf-8"?>\n` +
                                    `<configuration>\n` +
                                    `</configuration>`;