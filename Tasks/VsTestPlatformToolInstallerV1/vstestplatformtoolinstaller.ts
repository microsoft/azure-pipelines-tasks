import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as os from 'os';
import * as path from 'path';
import * as uuid from 'uuid';
import * as fs from 'fs';
import { exec } from 'child_process';
import * as perf from 'performance-now';
import * as ci from './cieventlogger';
import * as constants from './constants';
import * as helpers from './helpers';
import { TaskResult } from 'vsts-task-lib/task';
import { async } from 'q';
import { toolFolderName } from './constants';

const consolidatedCiData: { [key: string]: string; } = <{ [key: string]: string; }>{};

// First function to be invoke starting the installation
async function startInstaller() {
    try {
        const osPlat: string = os.platform();
        const packageSource = constants.defaultPackageSource;
        consolidatedCiData.operatingSystem = osPlat;
        consolidatedCiData.result = constants.installationStatusFailed;

        console.log(tl.loc('StartingInstaller'));
        console.log('==============================================================================');

        // Fail the task if os is not windows
        if (osPlat !== 'win32') {
            consolidatedCiData.failureReason = constants.unsupportedOS;
            tl.setResult(tl.TaskResult.Failed, tl.loc('OnlyWindowsOsSupported'));
            return;
        }

        // Read task inputs
        const packageFeedSelectorInput = tl.getInput(constants.packageFeedSelector, true);
        const versionSelectorInput = tl.getInput(constants.versionSelector, false);
        const testPlatformVersion = tl.getInput(constants.testPlatformVersion, false);
        const networkSharePath = tl.getInput(constants.netShare, false);
        const username = tl.getInput(constants.username, false);
        const password = tl.getInput(constants.password, false);
        const netSharePath = tl.getInput(constants.netShare, false);

        consolidatedCiData.packageFeedSelectorInput = packageFeedSelectorInput;

        tl.debug(`Selected package feed: ${packageFeedSelectorInput}`);
        switch (packageFeedSelectorInput.toLowerCase()) {

            case 'netshare':
                await getVsTestPlatformToolFromNetworkShare(netSharePath);
                break;

            case 'customfeed':
                await getVsTestPlatformToolFromCustomFeed(packageSource, versionSelectorInput, testPlatformVersion, username, password);
                break;

            case 'nugetorg':
                await getVsTestPlatformToolFromSpecifiedFeed(packageSource, testPlatformVersion, versionSelectorInput, null);
                break;
        }

    } catch (error) {
        ci.publishEvent('Completed', { isSetupSuccessful: 'false' } );
        tl.setResult(tl.TaskResult.Failed, error);
        return;
    }

    consolidatedCiData.result = constants.installationStatusSucceeded;
    ci.publishEvent('Completed', { isSetupSuccessful: 'true', startTime: consolidatedCiData.executionStartTime, endTime: perf() } );
}

// Installs the test platform from a custom feed provided by the user along with credentials for authentication against said feed
async function getVsTestPlatformToolFromCustomFeed(packageSource: string, versionSelectorInput: string, testPlatformVersion: string, username: string, password: string) {
    const tempConfigFilePath = helpers.GenerateTempFile(`${uuid.v1()}.config`);

    try {
        if (!helpers.isNullEmptyOrUndefined(password)) {
            prepareNugetConfigFile(packageSource, tempConfigFilePath, username, password);
            consolidatedCiData.passwordProvided = 'true';
            consolidatedCiData.usernameProvided = `${!helpers.isNullEmptyOrUndefined(username)}`;
        }
        await getVsTestPlatformToolFromSpecifiedFeed(packageSource, testPlatformVersion, versionSelectorInput, tempConfigFilePath);

    } finally {
        helpers.cleanUpTempConfigFile(tempConfigFilePath);
    }
}

// Installs the test platform from a network share path provided by the user. The path should point to a .nupkg file.
async function getVsTestPlatformToolFromNetworkShare(netSharePath: string) {
    let vstestPlatformInstalledLocation;
    let packageSource;

    tl.debug(`Attempting to fetch the vstest platform from the specified network share path ${netSharePath}.`);

    if (helpers.pathExistsAsFile(netSharePath)) {
        packageSource = path.dirname(netSharePath);
    } else {
        consolidatedCiData.failureReason = constants.packageFileDoesNotExist;
        throw new Error(tl.loc('SpecifiedFileDoesNotExist', netSharePath));
    }

    const fileName = path.basename(netSharePath);
    const versionExtractionRegex = constants.versionExtractionRegex;
    const regexMatches = versionExtractionRegex.exec(fileName);

    if (regexMatches.length !== 2) {
        consolidatedCiData.failureReason = constants.unexpectedPackageFileName;
        throw new Error(tl.loc('UnexpectedFileName', fileName));
    }
    const testPlatformVersion = regexMatches[1];
    consolidatedCiData.testPlatformVersion = testPlatformVersion;

    // If the version provided is not an explicit version (ie contains containing wildcards) then throw
    if (!toolLib.isExplicitVersion(testPlatformVersion)) {
        ci.publishEvent('InvalidVersionSpecified', { version: testPlatformVersion } );
        consolidatedCiData.failureReason = constants.notExplicitVersion;
        throw new Error(tl.loc('ProvideExplicitVersion', testPlatformVersion));
    }

    tl.debug(`Looking for version ${testPlatformVersion} in the tools cache.`);
    consolidatedCiData.cacheLookupStartTime = perf();

    // Check cache for the specified version
    vstestPlatformInstalledLocation = toolLib.findLocalTool(constants.toolFolderName, testPlatformVersion);

    consolidatedCiData.cacheLookupEndTime = perf();
    ci.publishEvent('CacheLookup', { CacheHit: (!helpers.isNullEmptyOrUndefined(vstestPlatformInstalledLocation)).toString(),
        isFallback: 'false', version: testPlatformVersion, startTime: consolidatedCiData.cacheLookupStartTime, endTime: consolidatedCiData.cacheLookupEndTime } );

    // If found in the cache then set the tool location and return
    if (!helpers.isNullEmptyOrUndefined(vstestPlatformInstalledLocation)) {
        consolidatedCiData.firstCacheLookupSucceeded = 'true';
        helpers.setVsTestToolLocation(vstestPlatformInstalledLocation);
        return;
    }

    consolidatedCiData.firstCacheLookupSucceeded = 'false';

    vstestPlatformInstalledLocation = await attemptPackageDownload(packageSource, testPlatformVersion);

    // Set the vstest platform tool location for the vstest task to consume
    helpers.setVsTestToolLocation(vstestPlatformInstalledLocation);
}

// Installs the test platform from the feed specified. If platfornVersion is null then the versionSelectorInput is read and the version
// is determined accordingly. Additionally provide the config file to help with authentication if the feed is a custom feed.
async function getVsTestPlatformToolFromSpecifiedFeed(packageSource: string, testPlatformVersion: string, versionSelectorInput: string, nugetConfigFilePath: string) {
    let vstestPlatformInstalledLocation: string;
    let includePreRelease: boolean;

    consolidatedCiData.versionSelectorInput = versionSelectorInput;
    tl.debug(`Using the package source ${packageSource} to get the ${constants.packageId} nuget package.`);

    if (versionSelectorInput.toLowerCase() === constants.latestStable) {
        console.log(tl.loc('LookingForLatestStableVersion'));
        testPlatformVersion = null;
        includePreRelease = false;

    } else if (versionSelectorInput.toLowerCase() === constants.latestPrerelease) {
        console.log(tl.loc('LookingForLatestPreReleaseVersion'));
        testPlatformVersion = null;
        includePreRelease = true;
    }

    if (versionSelectorInput.toLowerCase() !== constants.specificVersion) {

        try {
            consolidatedCiData.latestVersionIdentified = 'false';
            testPlatformVersion = getLatestPackageVersionNumber(packageSource, includePreRelease, nugetConfigFilePath);

            if (helpers.isNullEmptyOrUndefined(testPlatformVersion)) {

                tl.warning(tl.loc('RequiredVersionNotListed'));
                tl.debug('Looking for latest stable available version in cache.');
                ci.publishEvent('RequestedVersionNotListed', { action: 'getLatestAvailableInCache' } );
                // Look for the latest stable version available in the cache
                testPlatformVersion = 'x';

            } else {
                consolidatedCiData.latestVersionIdentified = 'true';
                tl.debug(`Found the latest version to be ${testPlatformVersion}.`);
                ci.publishEvent('RequestedVersionListed', { action: 'lookInCacheForListedVersion', version: testPlatformVersion } );
            }

        } catch (error) {
            // Failed to list available versions, look for the latest stable version available in the cache
            tl.error(`${tl.loc('FailedToListAvailablePackagesFromNuget')}\n${error}`);
            tl.debug('Looking for latest stable version available version in cache.');
            ci.publishEvent('RequestedVersionListFailed', { action: 'getLatestAvailableInCache', error: error } );
            testPlatformVersion = 'x';
        }
    }

    tl.debug(`Looking for version ${testPlatformVersion} in the tools cache.`);
    consolidatedCiData.cacheLookupStartTime = perf();

    // Check cache for the specified version
    vstestPlatformInstalledLocation = toolLib.findLocalTool(constants.toolFolderName, testPlatformVersion);

    consolidatedCiData.cacheLookupEndTime = perf();
    ci.publishEvent('CacheLookup', { CacheHit: (!helpers.isNullEmptyOrUndefined(vstestPlatformInstalledLocation)).toString(),
        isFallback: 'false', version: testPlatformVersion, startTime: consolidatedCiData.cacheLookupStartTime, endTime: consolidatedCiData.cacheLookupEndTime } );

    // If found in the cache then set the tool location and return
    if (!helpers.isNullEmptyOrUndefined(vstestPlatformInstalledLocation)) {
        consolidatedCiData.firstCacheLookupSucceeded = 'true';
        helpers.setVsTestToolLocation(vstestPlatformInstalledLocation);
        return;
    }

    consolidatedCiData.firstCacheLookupSucceeded = 'false';

    // If the testPlatformVersion is 'x' meaning listing failed and we were looking for a stable version in the cache
    // and the cache lookup failed, then fail the task
    if (!testPlatformVersion || testPlatformVersion === 'x') {
        tl.error(tl.loc('NoPackageFoundInCache'));
        consolidatedCiData.failureReason = constants.listingFailed;
        throw new Error(tl.loc('FailedToAcquireTestPlatform'));
    }

    // If the version provided is not an explicit version (ie contains containing wildcards) then throw
    if (!toolLib.isExplicitVersion(testPlatformVersion)) {
        ci.publishEvent('InvalidVersionSpecified', { version: testPlatformVersion } );
        consolidatedCiData.failureReason = constants.notExplicitVersion;
        throw new Error(tl.loc('ProvideExplicitVersion', testPlatformVersion));
    }

    vstestPlatformInstalledLocation = await attemptPackageDownload(packageSource, testPlatformVersion);

    // Set the vstest platform tool location for the vstest task to consume
    helpers.setVsTestToolLocation(vstestPlatformInstalledLocation);
}

// Utility function that writes the feed url along with username and password if provided into the specified nuget config file
function prepareNugetConfigFile(packageSource: string, configFilePath: string, username: string, password: string) {
    const feedUrl = tl.getInput(constants.customFeed);
    const feedId = uuid.v1();

    tl.debug(`Writing package source details to temp config file ${configFilePath}`);

    try {
        // Write the skeleton nuget config contents to the config file
        fs.writeFileSync(configFilePath, constants.emptyNugetConfig, { encoding: 'utf-8' });
    } catch (error) {
        consolidatedCiData.failureReason = 'configFileWriteFailed';
        throw new Error(tl.loc('ConfigFileWriteFailed', configFilePath, error));
    }

    const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));

    nugetTool.arg(constants.sources).arg(constants.add).arg(constants.noninteractive).arg(constants.name).arg(feedId).arg(constants.source).arg(feedUrl)
        .argIf(password, constants.usernameParam).argIf(password, username)
        .argIf(password, constants.passwordParam).argIf(password, password)
        .argIf(configFilePath, constants.configFile).argIf(configFilePath, configFilePath);

    consolidatedCiData.prepareConfigFileStartTime = perf();
    const result = nugetTool.execSync();
    consolidatedCiData.prepareConfigFileEndTime = perf();

    if (result.code !== 0 || !(result.stderr === null || result.stderr === undefined || result.stderr === '')) {
        consolidatedCiData.failureReason = constants.configFileWriteFailed;
        throw new Error(tl.loc('ConfigFileWriteFailed', configFilePath, result.stderr));
    }

    // Assign the feed name we wrote into the config file to the packageSource variable
    tl.debug(`Setting the source to feed with id ${feedId} whose details were written to the config file.`);
    packageSource = feedId;

    ci.publishEvent('PackageSourceOverridden', {packageSource: 'customFeed'} );
}

// Lists the latest version of the package available in the feed specified.
function getLatestPackageVersionNumber(packageSource: string, includePreRelease: boolean, nugetConfigFilePath: string): string {
    const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));

    consolidatedCiData.includePreRelease = `${includePreRelease}`;

    nugetTool.arg(constants.list).arg(`packageid:${constants.packageId}`).argIf(includePreRelease, constants.preRelease).arg(constants.source).arg(packageSource)
        .argIf(nugetConfigFilePath, constants.configFile).argIf(nugetConfigFilePath, nugetConfigFilePath);

    consolidatedCiData.ListLatestPackageStartTime = perf();
    const result = nugetTool.execSync();

    consolidatedCiData.ListLatestPackageEndTime = perf();
    ci.publishEvent('ListLatestVersion', { includePreRelease: includePreRelease, startTime: consolidatedCiData.ListLatestPackageStartTime,
        endTime: consolidatedCiData.ListLatestPackageEndTime } );

    if (result.code !== 0 || !(result.stderr === null || result.stderr === undefined || result.stderr === '')) {
        tl.error(tl.loc('NugetErrorCode', result.code));
        consolidatedCiData.listingPackagesFailed = 'true';
        throw new Error(tl.loc('ListPackagesFailed', result.code, result.stderr, result.stdout));
    }

    const listOfPackages = result.stdout.split('\r\n');
    let version: string;

    // parse the version number from the output string
    listOfPackages.forEach(nugetPackage => {
        if (nugetPackage.split(' ')[0] === constants.packageId) {
            version = nugetPackage.split(' ')[1];
            return;
        }
    });

    return version;
}

// Attemps to download the package and on failure looks for the latest stable version already present in the cache
async function attemptPackageDownload(packageSource: string, testPlatformVersion: string) : Promise<string> {
    let vstestPlatformInstalledLocation;
    try {
        tl.debug(`Could not find ${constants.packageId}.${testPlatformVersion} in the tools cache. Fetching it from nuget.`);

        // Download the required version and cache it
        vstestPlatformInstalledLocation = await acquireAndCacheVsTestPlatformNuget(packageSource, testPlatformVersion, null);

    } catch (error) {
        tl.error(tl.loc('TestPlatformDownloadFailed', testPlatformVersion, error));

        testPlatformVersion = 'x';

        consolidatedCiData.downloadSucceeded = 'false';
        ci.publishEvent('DownloadFailed', { action: 'getLatestAvailableInCache', error: error } );
        consolidatedCiData.secondCacheLookupStartTime = perf();

        // Download failed, look for the latest version available in the cache
        vstestPlatformInstalledLocation = toolLib.findLocalTool(constants.toolFolderName, testPlatformVersion);

        consolidatedCiData.secondCacheLookupEndTime = perf();
        ci.publishEvent('CacheLookup', { CacheHit: (!helpers.isNullEmptyOrUndefined(vstestPlatformInstalledLocation)).toString(),
            isFallback: 'true', version: testPlatformVersion, startTime: consolidatedCiData.secondCacheLookupStartTime, endTime: consolidatedCiData.secondCacheLookupEndTime } );

        // No version found in cache, fail the task
        if (!vstestPlatformInstalledLocation || vstestPlatformInstalledLocation === 'undefined') {
            consolidatedCiData.secondCacheLookupSucceeded = 'false';
            consolidatedCiData.failureReason = constants.downloadFailed;
            tl.error(tl.loc('NoPackageFoundInCache'));
            throw new Error(tl.loc('FailedToAcquireTestPlatform'));
        }

        consolidatedCiData.secondCacheLookupSucceeded = 'true';
    }

    return vstestPlatformInstalledLocation;
}

// Downloads and caches the test platform package
async function acquireAndCacheVsTestPlatformNuget(packageSource: string, testPlatformVersion: string, nugetConfigFilePath: string): Promise<string> {
    testPlatformVersion = toolLib.cleanVersion(testPlatformVersion);
    const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));
    let downloadPath = helpers.getTempFolder();

    // Ensure Agent.TempDirectory is set
    if (!downloadPath) {
        throw new Error('Expected Agent.TempDirectory to be set.');
    }

    // Call out a warning if the agent work folder path is longer than 50 characters as anything longer may cause the download to fail
    // Note: This upper limit was calculated for a particular test platform package version and is subject to change
    if (tl.getVariable(constants.agentWorkFolder) && tl.getVariable(constants.agentWorkFolder).length > 50) {
        consolidatedCiData.agentWorkDirectoryPathTooLong = 'true';
        tl.warning(tl.loc('AgentWorkDirectoryPathTooLong'));
    }

    // Use as short a path as possible due to nested folders in the package that may potentially exceed the 255 char windows path limit
    downloadPath = path.join(downloadPath, constants.toolFolderName);
    nugetTool.arg(constants.install).arg(constants.packageId).arg(constants.version).arg(testPlatformVersion).arg(constants.source)
        .arg(packageSource).arg(constants.outputDirectory).arg(downloadPath).arg(constants.noCache).arg(constants.directDownload)
        .argIf(nugetConfigFilePath, constants.configFile).argIf(nugetConfigFilePath, nugetConfigFilePath);

    tl.debug(`Downloading Test Platform version ${testPlatformVersion} from ${packageSource} to ${downloadPath}.`);
    consolidatedCiData.downloadStartTime = perf();
    const resultCode = await nugetTool.exec();
    consolidatedCiData.downloadEndTime = perf();

    tl.debug(`Nuget.exe returned with result code ${resultCode}`);

    if (resultCode !== 0) {
        tl.error(tl.loc('NugetErrorCode', resultCode));
        throw new Error(`Download failed with error code: ${resultCode}.`);
    }

    ci.publishEvent('DownloadPackage', { version: testPlatformVersion, startTime: consolidatedCiData.downloadStartTime, endTime: consolidatedCiData.downloadEndTime } );

    // Install into the local tool cache
    const toolRoot = path.join(downloadPath, constants.packageId + '.' + testPlatformVersion);

    tl.debug(`Caching the downloaded folder ${toolRoot}.`);
    consolidatedCiData.cacheStartTime = perf();
    const vstestPlatformInstalledLocation = await toolLib.cacheDir(toolRoot, constants.toolFolderName, testPlatformVersion);
    consolidatedCiData.cacheEndTime = perf();
    ci.publishEvent('CacheDownloadedPackage', { startTime: consolidatedCiData.cacheStartTime, endTime: consolidatedCiData.cacheEndTime } );
    return vstestPlatformInstalledLocation;
}

// Execution start
try {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    consolidatedCiData.executionStartTime = perf();
    startInstaller();
} finally {
    consolidatedCiData.executionEndTime = perf();
    ci.publishEvent('vstestToolInstallerConsolidatedCiEvent', consolidatedCiData);
}