import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as toolLib from 'vsts-task-tool-lib/tool';
//import * as restm from 'typed-rest-client/RestClient';
//import * as auth from 'nuget-task-common/Authentication';
//import * as peParser from 'nuget-task-common/pe-parser';
//import * as verInfo from 'nuget-task-common/pe-parser/VersionResource';
//import { IPackageSource } from 'nuget-task-common/Authentication';
//import { NuGetConfigHelper2 } from 'nuget-task-common/NuGetConfigHelper2';
//import * as locationHelpers from 'nuget-task-common/LocationHelpers';
//import * as nutil from 'nuget-task-common/Utility';
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

let packageSource = constants.defaultPackageSource;
const consolidatedCiData: { [key: string]: string; } = <{ [key: string]: string; }>{};

async function startInstaller() {
    let executionStartTime;

    try {
        const osPlat: string = os.platform();
        executionStartTime = perf();
        consolidatedCiData.executionStartTime = executionStartTime;
        consolidatedCiData.result = 'failed';

        tl.setResourcePath(path.join(__dirname, 'task.json'));

        console.log(tl.loc('StartingInstaller'));
        console.log('==============================================================================');

        ci.publishEvent('Start', { OS: osPlat, isSupportedOS: (osPlat === 'win32').toString(), startTime: executionStartTime } );
        consolidatedCiData.operatingSystem = osPlat;

        if (osPlat !== 'win32') {
            // Fail the task if os is not windows
            consolidatedCiData.executionEndTime = perf();
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
        // Todo: Add an input for cleaning up the tool cache?

        consolidatedCiData.packageFeedSelectorInput = packageFeedSelectorInput;

        ci.publishEvent('Options', {
            packageFeedSelectorInput: packageFeedSelectorInput,
            versionSelectorInput: versionSelectorInput,
            testPlatformVersion: testPlatformVersion
        });

        tl.debug(`Selected package feed: ${packageFeedSelectorInput}`);

        if (packageFeedSelectorInput.toLowerCase() === 'netshare') {
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
                throw new Error(tl.loc('UnexpectedFileName'));
            }
            const version = regexMatches[1];
            consolidatedCiData.testPlatformVersion = version;

            await getVsTestPlatformToolFromNetworkShare(version);

        } else if (packageFeedSelectorInput.toLowerCase() === 'vstsfeed') {

            // const feedId = tl.getInput('vstsFeed');
            // const accessToken = auth.getSystemAccessToken();
            // const nuGetVersion: verInfo.VersionInfo = await peParser.getFileVersionInfoAsync(path.join(__dirname, 'nuget.exe'));
            // const feedUrl = await nutil.getNuGetFeedRegistryUrl(accessToken, feedId, nuGetVersion);

            // const tempConfigFilePath = path.join(tl.getVariable('System.DefaultWorkingDirectory'), `${uuid.v1()}.config`);
            // fs.writeFileSync(tempConfigFilePath, Constants.emptyNugetConfig, { encoding: 'utf-8' });

            // const nugetTool = path.join(__dirname, 'nuget.exe');
            // const args = `sources Add -NonInteractive -Name ${feedId} -Source ${feedUrl}` +
            //     ` -Username "${}" -Password "${}" -ConfigFile ${tempConfigFilePath}`;

            // const options = <tr.IExecOptions>{};
            // const startTime = perf();
            // const result = tl.execSync(nugetTool, args, options);

            // // Assign the feed name we wrote into the config file to the packageSource variable
            // packageSource = feedId;

            // ci.publishEvent('PackageSourceOverridden', {packageSource: 'vstsFeed'} );
            // await getVsTestPlatformToolFromSpecifiedFeed(testPlatformVersion, versionSelectorInput, tempConfigFilePath);

        } else if (packageFeedSelectorInput.toLowerCase() === 'customfeed') {
            let tempConfigFilePath = null;
            if (!helpers.isNullEmptyOrUndefined(password)) {
                tempConfigFilePath = prepareNugetConfigFile(username, password);
                consolidatedCiData.passwordProvided = 'true';
                consolidatedCiData.usernameProvided = `${!helpers.isNullEmptyOrUndefined(username)}`;
            }
            await getVsTestPlatformToolFromSpecifiedFeed(testPlatformVersion, versionSelectorInput, tempConfigFilePath);
        } else {
            await getVsTestPlatformToolFromSpecifiedFeed(testPlatformVersion, versionSelectorInput, null);
        }

    } catch (error) {
        ci.publishEvent('Completed', { isSetupSuccessful: 'false', error: error.message } );
        tl.debug(error);
        tl.setResult(tl.TaskResult.Failed, error.message);
    }

    ci.publishEvent('Completed', { isSetupSuccessful: 'true', startTime: executionStartTime, endTime: perf() } );
}

async function getVsTestPlatformToolFromNetworkShare(testPlatformVersion: string) {
    let toolPath;

    // If the version provided is not an explicit version (ie contains containing wildcards) then throw
    if (!toolLib.isExplicitVersion(testPlatformVersion)) {
        ci.publishEvent('InvalidVersionSpecified', { version: testPlatformVersion } );
        throw new Error(tl.loc('ProvideExplicitVersion', testPlatformVersion));
    }

    // Check cache for the specified version
    tl.debug(`Looking for version ${testPlatformVersion} in the tools cache.`);
    let cacheLookupStartTime = perf();
    toolPath = toolLib.findLocalTool('VsTest', testPlatformVersion);

    ci.publishEvent('CacheLookup', { CacheHit: (!helpers.isNullEmptyOrUndefined(toolPath)).toString(),
        isFallback: 'false', version: testPlatformVersion, startTime: cacheLookupStartTime, endTime: perf() } );

    // If found in the cache then set the tool location and return
    if (!helpers.isNullEmptyOrUndefined(toolPath)) {
        setVsTestToolLocation(toolPath);
        return;
    }

    // Download the required version and cache it
    try {
        tl.debug(`Could not find ${constants.packageId}.${testPlatformVersion} in the tools cache. Fetching it from nuget.`);
        toolPath = await acquireAndCacheVsTestPlatformNuget(testPlatformVersion, null);
    } catch (error) {
        // Download failed, look for the latest version available in the cache
        tl.warning(tl.loc('TestPlatformDownloadFailed', testPlatformVersion, error));
        ci.publishEvent('DownloadFailed', { action: 'getLatestAvailableInCache', error: error } );
        testPlatformVersion = 'x';
        cacheLookupStartTime = perf();
        toolPath = toolLib.findLocalTool('VsTest', testPlatformVersion);

        ci.publishEvent('CacheLookup', { CacheHit: (!helpers.isNullEmptyOrUndefined(toolPath)).toString(),
            isFallback: 'true', version: testPlatformVersion, startTime: cacheLookupStartTime, endTime: perf() } );

        if (!toolPath || toolPath === 'undefined') {
            // No version found in cache, fail the task
            tl.warning(tl.loc('NoPackageFoundInCache'));
            throw new Error(tl.loc('FailedToAcquireTestPlatform'));
        }
    }

    // Set the vstest platform tool location for the vstest task to consume
    setVsTestToolLocation(toolPath);
}

async function getVsTestPlatformToolFromSpecifiedFeed(testPlatformVersion: string, versionSelectorInput: string, nugetConfigFilePath: string) {
    // Should point to the location where the VsTest platform tool will be
    let toolPath: string;
    let includePreRelease: boolean;

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
            testPlatformVersion = getLatestPackageVersionNumber(includePreRelease, nugetConfigFilePath);
            if (helpers.isNullEmptyOrUndefined(testPlatformVersion)) {
                tl.warning(tl.loc('RequiredVersionNotListed'));
                tl.debug('Looking for latest stable available version in cache.');
                ci.publishEvent('RequestedVersionNotListed', { action: 'getLatestAvailableInCache' } );
                // Look for the latest stable version available in the cache
                testPlatformVersion = 'x';
            } else {
                tl.debug(`Found the latest version to be ${testPlatformVersion}.`);
                ci.publishEvent('RequestedVersionListed', { action: 'lookInCacheForListedVersion', version: testPlatformVersion } );
            }
        } catch (error) {
            // Failed to list available versions, look for the latest stable version available in the cache
            tl.warning(`${tl.loc('FailedToListAvailablePackagesFromNuget')}\n${error}`);
            tl.debug('Looking for latest stable version available version in cache.');
            ci.publishEvent('RequestedVersionListFailed', { action: 'getLatestAvailableInCache', error: error } );
            testPlatformVersion = 'x';
        }
    }

    // Check cache for the specified version
    tl.debug(`Looking for version ${testPlatformVersion} in the tools cache.`);
    let cacheLookupStartTime = perf();
    toolPath = toolLib.findLocalTool('VsTest', testPlatformVersion);

    ci.publishEvent('CacheLookup', { CacheHit: (!helpers.isNullEmptyOrUndefined(toolPath)).toString(),
        isFallback: 'false', version: testPlatformVersion, startTime: cacheLookupStartTime, endTime: perf() } );

    // If found in the cache then set the tool location and return
    if (!helpers.isNullEmptyOrUndefined(toolPath)) {
        setVsTestToolLocation(toolPath);
        return;
    }

    // If the testPlatformVersion is 'x' meaning listing failed and we were looking for a stable version in the cache
    // and the cache lookup failed, then fail the task
    if (!testPlatformVersion || testPlatformVersion === 'x') {
        tl.warning(tl.loc('NoPackageFoundInCache'));
        throw new Error(tl.loc('FailedToAcquireTestPlatform'));
    }

    // If the version provided is not an explicit version (ie contains containing wildcards) then throw
    if (!toolLib.isExplicitVersion(testPlatformVersion)) {
        ci.publishEvent('InvalidVersionSpecified', { version: testPlatformVersion } );
        throw new Error(tl.loc('ProvideExplicitVersion', testPlatformVersion));
    }

    // Download the required version and cache it
    try {
        tl.debug(`Could not find ${constants.packageId}.${testPlatformVersion} in the tools cache. Fetching it from nuget.`);
        toolPath = await acquireAndCacheVsTestPlatformNuget(testPlatformVersion, nugetConfigFilePath);
    } catch (error) {
        // Download failed, look for the latest version available in the cache
        tl.warning(tl.loc('TestPlatformDownloadFailed', testPlatformVersion, error));
        ci.publishEvent('DownloadFailed', { action: 'getLatestAvailableInCache', error: error } );
        testPlatformVersion = 'x';
        cacheLookupStartTime = perf();
        toolPath = toolLib.findLocalTool('VsTest', testPlatformVersion);

        ci.publishEvent('CacheLookup', { CacheHit: (!helpers.isNullEmptyOrUndefined(toolPath)).toString(),
            isFallback: 'true', version: testPlatformVersion, startTime: cacheLookupStartTime, endTime: perf() } );

        if (!toolPath || toolPath === 'undefined') {
            // No version found in cache, fail the task
            tl.warning(tl.loc('NoPackageFoundInCache'));
            throw new Error(tl.loc('FailedToAcquireTestPlatform'));
        }
    }

    // Set the vstest platform tool location for the vstest task to consume
    setVsTestToolLocation(toolPath);
}

function prepareNugetConfigFile(username: string, password: string) {
    const feedUrl = tl.getInput('customFeed');
    const feedId = uuid.v1();

    const tempConfigFilePath = helpers.GenerateTempFile(`${uuid.v1()}.config`);
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

    const options = <tr.IExecOptions>{};
    const startTime = perf();
    const result = nugetTool.execSync(options);

    if (result.code !== 0 || !(result.stderr === null || result.stderr === undefined || result.stderr === '')) {
        throw new Error(tl.loc('ConfigFileWriteFailed', tempConfigFilePath, result.stderr));
    }

    // Assign the feed name we wrote into the config file to the packageSource variable
    tl.debug(`Setting the source to feed with id ${feedId} whose details were written to the config file.`);
    packageSource = feedId;

    ci.publishEvent('PackageSourceOverridden', {packageSource: 'customFeed'} );
}

function getLatestPackageVersionNumber(includePreRelease: boolean, nugetConfigFilePath: string): string {
    const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));

    nugetTool.arg('list').arg(`packageid:${constants.packageId}`).argIf(includePreRelease, '-PreRelease').arg('-Source').arg(packageSource)
        .argIf(nugetConfigFilePath, '-ConfigFile').argIf(nugetConfigFilePath, nugetConfigFilePath);

    const options = <tr.IExecSyncOptions>{};

    const startTime = perf();
    const result = nugetTool.execSync(options);

    ci.publishEvent('ListLatestVersion', { includePreRelease: includePreRelease, startTime: startTime, endTime: perf() } );

    if (result.code !== 0 || !(result.stderr === null || result.stderr === undefined || result.stderr === '')) {
        tl.warning(tl.loc('NugetErrorCode', result.code));
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
        tl.warning(tl.loc('AgentWorkDirectoryPathTooLong'));
    }

    // Use as short a path as possible due to nested folders in the package that may potentially exceed the 255 char windows path limit
    downloadPath = path.join(downloadPath, 'VsTest');
    nugetTool.arg('install').arg(constants.packageId).arg('-Version').arg(testPlatformVersion).arg('-Source')
        .arg(packageSource).arg('-OutputDirectory').arg(downloadPath).arg('-NoCache').arg('-DirectDownload')
        .argIf(nugetConfigFilePath, '-ConfigFile').argIf(nugetConfigFilePath, nugetConfigFilePath);

    tl.debug(`Downloading Test Platform version ${testPlatformVersion} from ${packageSource} to ${downloadPath}.`);
    let startTime = perf();
    const resultCode = await nugetTool.exec();

    tl.debug(`Nuget.exe returned with result code ${resultCode}`);

    if (resultCode !== 0) {
        tl.warning(tl.loc('NugetErrorCode', resultCode));
        throw new Error(`Download failed with error code: ${resultCode}.`);
    }

    ci.publishEvent('DownloadPackage', { version: testPlatformVersion, startTime: startTime, endTime: perf() } );

    // Install into the local tool cache
    const toolRoot = path.join(downloadPath, constants.packageId + '.' + testPlatformVersion);

    tl.debug(`Caching the downloaded folder ${toolRoot}.`);
    startTime = perf();
    const toolPath = await toolLib.cacheDir(toolRoot, 'VsTest', testPlatformVersion);
    ci.publishEvent('CacheDownloadedPackage', { startTime: startTime, endTime: perf() } );
    return toolPath;
}

function setVsTestToolLocation(toolPath: string) {
    // Set the task variable so that the VsTest task can consume this path
    tl.setVariable('VsTestToolsInstallerInstalledToolLocation', toolPath);
    console.log(tl.loc('InstallationSuccessful', toolPath));
    tl.debug(`Set variable VsTestToolsInstallerInstalledToolLocation value to ${toolPath}.`);
}

// Execution start
startInstaller();