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

let packageSource = constants.defaultPackageSource;
const consolidatedCiData: { [key: string]: string; } = <{ [key: string]: string; }>{};

async function startInstaller() {
    try {
        const osPlat: string = os.platform();
        consolidatedCiData.operatingSystem = osPlat;
        consolidatedCiData.result = 'failed';

        console.log(tl.loc('StartingInstaller'));
        console.log('==============================================================================');

        // Fail the task if os is not windows
        if (osPlat !== 'win32') {
            consolidatedCiData.failureReason = 'unsupportedOS';
            tl.setResult(tl.TaskResult.Failed, tl.loc('OnlyWindowsOsSupported'));
            return;
        }

        // Read task inputs
        const packageFeedSelectorInput = tl.getInput('packageFeedSelector', true);
        const versionSelectorInput = tl.getInput('versionSelector', false);
        const testPlatformVersion = tl.getInput('testPlatformVersion', false);
        const networkSharePath = tl.getInput('netShare', false);
        const username = tl.getInput('username', false);
        const password = tl.getInput('password', false);
        const netSharePath = tl.getInput('netShare', false);

        consolidatedCiData.packageFeedSelectorInput = packageFeedSelectorInput;

        tl.debug(`Selected package feed: ${packageFeedSelectorInput}`);
        switch (packageFeedSelectorInput.toLowerCase()) {

            case 'netshare':
                await getVsTestPlatformToolFromNetworkShare(netSharePath);
                break;

            case 'customfeed':
                await getVsTestPlatformToolFromCustomFeed(versionSelectorInput, testPlatformVersion, username, password);
                break;

            case 'nugetorg':
                await getVsTestPlatformToolFromSpecifiedFeed(testPlatformVersion, versionSelectorInput, null);
                break;
        }

    } catch (error) {
        ci.publishEvent('Completed', { isSetupSuccessful: 'false' } );
        tl.setResult(tl.TaskResult.Failed, error);
        return;
    }

    consolidatedCiData.result = 'succeeded';
    ci.publishEvent('Completed', { isSetupSuccessful: 'true', startTime: consolidatedCiData.executionStartTime, endTime: perf() } );
}

async function getVsTestPlatformToolFromCustomFeed(versionSelectorInput: string, testPlatformVersion: string, username: string, password: string) {
    const tempConfigFilePath = helpers.GenerateTempFile(`${uuid.v1()}.config`);

    try {
        if (!helpers.isNullEmptyOrUndefined(password)) {
            prepareNugetConfigFile(tempConfigFilePath, username, password);
            consolidatedCiData.passwordProvided = 'true';
            consolidatedCiData.usernameProvided = `${!helpers.isNullEmptyOrUndefined(username)}`;
        }
        await getVsTestPlatformToolFromSpecifiedFeed(testPlatformVersion, versionSelectorInput, tempConfigFilePath);

    } finally {
        helpers.cleanUpTempConfigFile(tempConfigFilePath);
    }
}

async function getVsTestPlatformToolFromNetworkShare(netSharePath: string) {
    let vstestPlatformInstalledLocation;

    tl.debug(`Attempting to fetch the vstest platform from the specified network share path ${netSharePath}.`);

    if (helpers.pathExistsAsFile(netSharePath)) {
        packageSource = path.dirname(netSharePath);
    } else {
        consolidatedCiData.failureReason = 'packageFileDoesNotExist';
        throw new Error(tl.loc('SpecifiedFileDoesNotExist', netSharePath));
    }

    const fileName = path.basename(netSharePath);
    const versionExtractionRegex = /microsoft\.testplatform\.(.*)\.nupkg/i;
    const regexMatches = versionExtractionRegex.exec(fileName);

    if (regexMatches.length !== 2) {
        consolidatedCiData.failureReason = 'unexpectedPackageFileName';
        throw new Error(tl.loc('UnexpectedFileName', fileName));
    }
    const testPlatformVersion = regexMatches[1];
    consolidatedCiData.testPlatformVersion = testPlatformVersion;

    // If the version provided is not an explicit version (ie contains containing wildcards) then throw
    if (!toolLib.isExplicitVersion(testPlatformVersion)) {
        ci.publishEvent('InvalidVersionSpecified', { version: testPlatformVersion } );
        consolidatedCiData.failureReason = 'notExplicitVersion';
        throw new Error(tl.loc('ProvideExplicitVersion', testPlatformVersion));
    }

    tl.debug(`Looking for version ${testPlatformVersion} in the tools cache.`);
    consolidatedCiData.cacheLookupStartTime = perf();

    // Check cache for the specified version
    vstestPlatformInstalledLocation = toolLib.findLocalTool('VsTest', testPlatformVersion);

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

    vstestPlatformInstalledLocation = await attemptPackageDownload(testPlatformVersion);

    // Set the vstest platform tool location for the vstest task to consume
    helpers.setVsTestToolLocation(vstestPlatformInstalledLocation);
}

async function getVsTestPlatformToolFromSpecifiedFeed(testPlatformVersion: string, versionSelectorInput: string, nugetConfigFilePath: string) {
    let vstestPlatformInstalledLocation: string;
    let includePreRelease: boolean;

    consolidatedCiData.versionSelectorInput = versionSelectorInput;
    tl.debug(`Using the package source ${packageSource} to get the ${constants.packageId} nuget package.`);

    if (versionSelectorInput.toLowerCase() === 'lateststable') {
        console.log(tl.loc('LookingForLatestStableVersion'));
        testPlatformVersion = null;
        includePreRelease = false;

    } else if (versionSelectorInput.toLowerCase() === 'latestprerelease') {
        console.log(tl.loc('LookingForLatestPreReleaseVersion'));
        testPlatformVersion = null;
        includePreRelease = true;
    }

    if (versionSelectorInput.toLowerCase() !== 'specificversion') {

        try {
            consolidatedCiData.latestVersionIdentified = 'false';
            testPlatformVersion = getLatestPackageVersionNumber(includePreRelease, nugetConfigFilePath);

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
    vstestPlatformInstalledLocation = toolLib.findLocalTool('VsTest', testPlatformVersion);

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
        consolidatedCiData.failureReason = 'listingFailed';
        throw new Error(tl.loc('FailedToAcquireTestPlatform'));
    }

    // If the version provided is not an explicit version (ie contains containing wildcards) then throw
    if (!toolLib.isExplicitVersion(testPlatformVersion)) {
        ci.publishEvent('InvalidVersionSpecified', { version: testPlatformVersion } );
        consolidatedCiData.failureReason = 'notExplicitVersion';
        throw new Error(tl.loc('ProvideExplicitVersion', testPlatformVersion));
    }

    vstestPlatformInstalledLocation = await attemptPackageDownload(testPlatformVersion);

    // Set the vstest platform tool location for the vstest task to consume
    helpers.setVsTestToolLocation(vstestPlatformInstalledLocation);
}

function prepareNugetConfigFile(tempConfigFilePath: string, username: string, password: string) {
    const feedUrl = tl.getInput('customFeed');
    const feedId = uuid.v1();

    tl.debug(`Writing package source details to temp config file ${tempConfigFilePath}`);

    try {
        fs.writeFileSync(tempConfigFilePath, constants.emptyNugetConfig, { encoding: 'utf-8' });
    } catch (error) {
        consolidatedCiData.failureReason = 'configFileWriteFailed';
        throw new Error(tl.loc('ConfigFileWriteFailed', tempConfigFilePath, error));
    }

    const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));

    nugetTool.arg('sources').arg('Add').arg('-NonInteractive').arg('-Name').arg(feedId).arg('-Source').arg(feedUrl)
        .argIf(password, '-Username').argIf(password, username)
        .argIf(password, '-Password').argIf(password, password)
        .argIf(tempConfigFilePath, '-ConfigFile').argIf(tempConfigFilePath, tempConfigFilePath);

    consolidatedCiData.prepareConfigFileStartTime = perf();
    const result = nugetTool.execSync();
    consolidatedCiData.prepareConfigFileEndTime = perf();

    if (result.code !== 0 || !(result.stderr === null || result.stderr === undefined || result.stderr === '')) {
        consolidatedCiData.failureReason = 'configFileWriteFailed';
        throw new Error(tl.loc('ConfigFileWriteFailed', tempConfigFilePath, result.stderr));
    }

    // Assign the feed name we wrote into the config file to the packageSource variable
    tl.debug(`Setting the source to feed with id ${feedId} whose details were written to the config file.`);
    packageSource = feedId;

    ci.publishEvent('PackageSourceOverridden', {packageSource: 'customFeed'} );
}

function getLatestPackageVersionNumber(includePreRelease: boolean, nugetConfigFilePath: string): string {
    const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));

    consolidatedCiData.includePreRelease = `${includePreRelease}`;

    nugetTool.arg('list').arg(`packageid:${constants.packageId}`).argIf(includePreRelease, '-PreRelease').arg('-Source').arg(packageSource)
        .argIf(nugetConfigFilePath, '-ConfigFile').argIf(nugetConfigFilePath, nugetConfigFilePath);

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

async function attemptPackageDownload(testPlatformVersion: string) : Promise<string> {
    let vstestPlatformInstalledLocation;
    try {
        tl.debug(`Could not find ${constants.packageId}.${testPlatformVersion} in the tools cache. Fetching it from nuget.`);

        // Download the required version and cache it
        vstestPlatformInstalledLocation = await acquireAndCacheVsTestPlatformNuget(testPlatformVersion, null);

    } catch (error) {
        tl.error(tl.loc('TestPlatformDownloadFailed', testPlatformVersion, error));

        testPlatformVersion = 'x';

        consolidatedCiData.downloadSucceeded = 'false';
        ci.publishEvent('DownloadFailed', { action: 'getLatestAvailableInCache', error: error } );
        consolidatedCiData.secondCacheLookupStartTime = perf();

        // Download failed, look for the latest version available in the cache
        vstestPlatformInstalledLocation = toolLib.findLocalTool('VsTest', testPlatformVersion);

        consolidatedCiData.secondCacheLookupEndTime = perf();
        ci.publishEvent('CacheLookup', { CacheHit: (!helpers.isNullEmptyOrUndefined(vstestPlatformInstalledLocation)).toString(),
            isFallback: 'true', version: testPlatformVersion, startTime: consolidatedCiData.secondCacheLookupStartTime, endTime: consolidatedCiData.secondCacheLookupEndTime } );

        // No version found in cache, fail the task
        if (!vstestPlatformInstalledLocation || vstestPlatformInstalledLocation === 'undefined') {
            consolidatedCiData.secondCacheLookupSucceeded = 'false';
            consolidatedCiData.failureReason = 'downloadFailed';
            tl.error(tl.loc('NoPackageFoundInCache'));
            throw new Error(tl.loc('FailedToAcquireTestPlatform'));
        }

        consolidatedCiData.secondCacheLookupSucceeded = 'true';
    }

    return vstestPlatformInstalledLocation;
}

async function acquireAndCacheVsTestPlatformNuget(testPlatformVersion: string, nugetConfigFilePath: string): Promise<string> {
    testPlatformVersion = toolLib.cleanVersion(testPlatformVersion);
    const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));
    let downloadPath = helpers.getTempFolder();

    // Ensure Agent.TempDirectory is set
    if (!downloadPath) {
        throw new Error('Expected Agent.TempDirectory to be set');
    }

    // Call out a warning if the agent work folder path is longer than 50 characters as anything longer may cause the download to fail
    // Note: This upper limit was calculated for a particular test platform package version and is subject to change
    if (tl.getVariable('Agent.WorkFolder') && tl.getVariable('Agent.WorkFolder').length > 50) {
        consolidatedCiData.agentWorkDirectoryPathTooLong = 'true';
        tl.warning(tl.loc('AgentWorkDirectoryPathTooLong'));
    }

    // Use as short a path as possible due to nested folders in the package that may potentially exceed the 255 char windows path limit
    downloadPath = path.join(downloadPath, 'VsTest');
    nugetTool.arg('install').arg(constants.packageId).arg('-Version').arg(testPlatformVersion).arg('-Source')
        .arg(packageSource).arg('-OutputDirectory').arg(downloadPath).arg('-NoCache').arg('-DirectDownload')
        .argIf(nugetConfigFilePath, '-ConfigFile').argIf(nugetConfigFilePath, nugetConfigFilePath);

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
    const vstestPlatformInstalledLocation = await toolLib.cacheDir(toolRoot, 'VsTest', testPlatformVersion);
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