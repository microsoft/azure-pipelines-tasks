import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as restm from 'typed-rest-client/RestClient';
import * as os from 'os';
import * as path from 'path';
import * as ci from './cieventlogger';
import { exec } from 'child_process';
const perf = require('performance-now');

const packageName = 'Microsoft.TestPlatform';
let packageSource = 'https://api.nuget.org/v3/index.json';

async function startInstaller() {
    let executionStartTime;

    try {
        const osPlat: string = os.platform();
        executionStartTime = perf();

        tl.setResourcePath(path.join(__dirname, 'task.json'));

        console.log(tl.loc('StartingInstaller'));
        console.log('==============================================================================');

        ci.publishEvent('Start', { OS: osPlat, isSupportedOS: (osPlat === 'win32').toString(), startTime: executionStartTime } );

        if (osPlat !== 'win32') {
            // Fail the task if os is not windows
            tl.setResult(tl.TaskResult.Failed, tl.loc('OnlyWindowsOsSupported'));
            return;
        }

        // Read task inputs
        const versionSelectorInput = tl.getInput('versionSelector', true);
        const testPlatformVersion = tl.getInput('testPlatformVersion', false);

        // Read backdoor variables used to tweak the task for testing/development purposes
        // Change the package source, mainly used to get the latest from the myget feed
        const overridenPackageSource = tl.getVariable('overridePackageSource');
        if (overridenPackageSource && overridenPackageSource !== '') {
            packageSource = overridenPackageSource;
            ci.publishEvent('PackageSourceOverridden', {packageSource: packageSource} );
        }
        tl.debug(`Using the package source ${packageSource} to get the ${packageName} nuget package.`);

        ci.publishEvent('Options', { versionSelectorInput: versionSelectorInput, testPlatformVersion: testPlatformVersion } );

        // TODO: Add an input for cleaning up the tool cache?

        // Get the required version of the platform and make necessary preparation to allow its consumption down the phase
        await getVsTestPlatformTool(testPlatformVersion, versionSelectorInput);
    } catch (error) {
        ci.publishEvent('Completed', { isSetupSuccessful: 'false', error: error.message } );
        tl.setResult(tl.TaskResult.Failed, error.message);
    } finally {
        ci.publishEvent('Completed', { isSetupSuccessful: 'true', startTime: executionStartTime, endTime: perf() } );
    }
}

async function getVsTestPlatformTool(testPlatformVersion: string, versionSelectorInput: string) {
    // Should point to the location where the VsTest platform tool will be
    let toolPath: string;
    let includePreRelease: boolean;

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
            testPlatformVersion = getLatestPackageVersionNumber(includePreRelease);
            if (testPlatformVersion === null) {
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
    ci.publishEvent('CacheLookup', { CacheHit: (toolPath !== null && toolPath !== undefined && toolPath !== 'undefined').toString(), isFallback: 'false', version: testPlatformVersion, startTime: cacheLookupStartTime, endTime: perf() } );

    // If found in the cache then set the tool location and return
    if (toolPath && toolPath !== 'undefined') {
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
        tl.debug(`Could not find ${packageName}.${testPlatformVersion} in the tools cache. Fetching it from nuget.`);
        toolPath = await acquireAndCacheVsTestPlatformNuget(testPlatformVersion);
    } catch (error) {
        // Download failed, look for the latest version available in the cache
        tl.warning(tl.loc('TestPlatformDownloadFailed', testPlatformVersion));
        ci.publishEvent('DownloadFailed', { action: 'getLatestAvailableInCache', error: error } );
        testPlatformVersion = 'x';
        cacheLookupStartTime = perf();
        toolPath = toolLib.findLocalTool('VsTest', testPlatformVersion);
        ci.publishEvent('CacheLookup', { CacheHit: (toolPath !== null && toolPath !== undefined && toolPath !== 'undefined').toString(), isFallback: 'true', version: testPlatformVersion, startTime: cacheLookupStartTime, endTime: perf() } );
        if (!toolPath || toolPath === 'undefined') {
            // No version found in cache, fail the task
            tl.warning(tl.loc('NoPackageFoundInCache'));
            throw new Error(tl.loc('FailedToAcquireTestPlatform'));
        }
    }

    // Set the vstest platform tool location for the vstest task to consume
    setVsTestToolLocation(toolPath);
}

function setVsTestToolLocation(toolPath: string) {
    // Set the task variable so that the VsTest task can consume this path
    tl.setVariable('VsTestToolsInstallerInstalledToolLocation', toolPath);
    console.log(tl.loc('InstallationSuccessful', toolPath));
    tl.debug(`Set variable VsTestToolsInstallerInstalledToolLocation value to ${toolPath}.`);
}

function getLatestPackageVersionNumber(includePreRelease: boolean): string {
    const nugetTool = path.join(__dirname, 'nuget.exe');
    let args = undefined;

    if (includePreRelease === true) {
        args = 'list ' + packageName + ' -PreRelease' + ' -Source ' + packageSource;
    } else {
        args = 'list ' + packageName + ' -Source ' + packageSource;
    }

    tl.debug(`Executing nuget.exe with args ${args} to list all available packages to identify latest version.`);

    const options = <tr.IExecOptions>{};

    const startTime = perf();
    const result = tl.execSync(nugetTool, args, options);

    ci.publishEvent('ListLatestVersion', { includePreRelease: includePreRelease, startTime: startTime, endTime: perf() } );

    if (result.code !== 0 || !(result.stderr === null || result.stderr === undefined || result.stderr === '')) {
        tl.warning(tl.loc('NugetErrorCode', result.code));
        throw new Error(tl.loc('ListPackagesFailed', result.code, result.stderr, result.stdout));
    }

    const listOfPackages = result.stdout.split('\r\n');
    let version: string;

    // Nuget returns latest vesions of all packages that match the given name, we need to filter out the exact package we need from this list
    listOfPackages.forEach(nugetPackage => {
        if (nugetPackage.split(' ')[0] === packageName) {
            version = nugetPackage.split(' ')[1];
            return;
        }
    });

    return version;
}

async function acquireAndCacheVsTestPlatformNuget(testPlatformVersion: string): Promise<string> {
    testPlatformVersion = toolLib.cleanVersion(testPlatformVersion);
    const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));
    let downloadPath = tl.getVariable('Agent.TempDirectory');

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
    nugetTool.line('install ' + packageName + ' -Version ' + testPlatformVersion + ' -Source ' + packageSource + ' -OutputDirectory "' + downloadPath + '" -NoCache -DirectDownload');

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
    const toolRoot = path.join(downloadPath, packageName + '.' + testPlatformVersion);

    tl.debug(`Caching the downloaded folder ${toolRoot}.`);
    startTime = perf();
    const toolPath = await toolLib.cacheDir(toolRoot, 'VsTest', testPlatformVersion);
    ci.publishEvent('CacheDownloadedPackage', { startTime: startTime, endTime: perf() } );
    return toolPath;
}

// Execution start
startInstaller();