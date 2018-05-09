import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as restm from 'typed-rest-client/RestClient';
import * as os from 'os';
import * as path from 'path';
import * as ci from './cieventlogger';
import { exec } from 'child_process';
import fs = require('fs');
const perf = require('performance-now');

function debugLog(str: string) {
    try {
        fs.appendFileSync(diagnosticLogFilePath, `debug ${new Date(Date.now()).toUTCString()}: ${str}\n`);
    } catch (err) {
        // No-op
    }
    tl.debug(str);
}

function consoleLog(str: string) {
    try {
        fs.appendFileSync(diagnosticLogFilePath, `console ${new Date(Date.now()).toUTCString()}: ${str}\n`);
    } catch (err) {
        // No-op
    }
    console.log(str);
}

function warningLog(str: string) {
    try {
        fs.appendFileSync(diagnosticLogFilePath, `warning ${new Date(Date.now()).toUTCString()}: ${str}\n`);
    } catch (err) {
        // No-op
    }
    tl.warning(str);
}

const diagnosticLogFilePath = path.join(tl.getVariable('Agent.TempDirectory'), 'VsTestToolInstallerDiagLog.txt');
const packageName = 'Microsoft.TestPlatform';
debugLog('011');
let packageSource = 'https://api.nuget.org/v3/index.json';
debugLog('013');

async function startInstaller() {
    debugLog('015');
    let executionStartTime;
    debugLog('017');

    try {
        debugLog('020');
        const osPlat: string = os.platform();
        debugLog('022');
        executionStartTime = perf();
        debugLog('024');

        tl.setResourcePath(path.join(__dirname, 'task.json'));
        debugLog('027');

        consoleLog(tl.loc('StartingInstaller'));
        debugLog('030');
        consoleLog('==============================================================================');
        debugLog('032');

        ci.publishEvent('Start', { OS: osPlat, isSupportedOS: (osPlat === 'win32').toString(), startTime: executionStartTime } );
        debugLog('035');

        if (osPlat !== 'win32') {
            debugLog('038');
            // Fail the task if os is not windows
            debugLog('040');
            tl.setResult(tl.TaskResult.Failed, tl.loc('OnlyWindowsOsSupported'));
            debugLog('042');
            return;
        }
        debugLog('046');

        // Read task inputs
        debugLog('049');
        const versionSelectorInput = tl.getInput('versionSelector', true);
        debugLog('051');
        const testPlatformVersion = tl.getInput('testPlatformVersion', false);
        debugLog('053');

        // Read backdoor variables used to tweak the task for testing/development purposes
        debugLog('056');
        // Change the package source, mainly used to get the latest from the myget feed
        debugLog('058');
        const overridenPackageSource = tl.getVariable('overridePackageSource');
        debugLog('060');
        if (overridenPackageSource && overridenPackageSource !== '') {
            debugLog('062');
            packageSource = overridenPackageSource;
            debugLog('064');
            ci.publishEvent('PackageSourceOverridden', {packageSource: packageSource} );
            debugLog('066');
        }
        debugLog('068');
        debugLog(`Using the package source ${packageSource} to get the ${packageName} nuget package.`);
        debugLog('070');

        ci.publishEvent('Options', { versionSelectorInput: versionSelectorInput, testPlatformVersion: testPlatformVersion } );
        debugLog('073');

        // TODO: Add an input for cleaning up the tool cache
        debugLog('076');

        // Get the required version of the platform and make necessary preparation to allow its consumption down the phase
        debugLog('079');
        await getVsTestPlatformTool(testPlatformVersion, versionSelectorInput);
        debugLog('081');
    } catch (error) {
        debugLog('083');
        ci.publishEvent('Completed', { isSetupSuccessful: 'false', error: error.message } );
        debugLog('085');
        tl.setResult(tl.TaskResult.Failed, error.message);
        debugLog('087');
    } finally {
        debugLog('089');
        ci.publishEvent('Completed', { isSetupSuccessful: 'true', startTime: executionStartTime, endTime: perf() } );
        debugLog('091');
    }
    debugLog('093');
}

async function getVsTestPlatformTool(testPlatformVersion: string, versionSelectorInput: string) {
    debugLog('098');
    // Should point to the location where the VsTest platform tool will be
    debugLog('100');
    let toolPath: string;
    debugLog('102');
    let includePreRelease: boolean;
    debugLog('104');

    if (versionSelectorInput.toLowerCase() === 'lateststable') {
        debugLog('107');
        consoleLog(tl.loc('LookingForLatestStableVersion'));
        debugLog('109');
        testPlatformVersion = null;
        debugLog('111');
        includePreRelease = false;
        debugLog('113');
    } else if (versionSelectorInput.toLowerCase() === 'latestprerelease') {
        debugLog('115');
        consoleLog(tl.loc('LookingForLatestPreReleaseVersion'));
        debugLog('117');
        testPlatformVersion = null;
        debugLog('119');
        includePreRelease = true;
        debugLog('121');
    }
    debugLog('123');

    if (versionSelectorInput.toLowerCase() !== 'specificversion') {
        debugLog('126');
        try {
            debugLog('128');
            testPlatformVersion = getLatestPackageVersionNumber(includePreRelease);
            debugLog('130');
            if (testPlatformVersion === null) {
                debugLog('132');
                warningLog(tl.loc('RequiredVersionNotListed'));
                debugLog('134');
                debugLog('Looking for latest stable available version in cache.');
                debugLog('136');
                ci.publishEvent('RequestedVersionNotListed', { action: 'getLatestAvailableInCache' } );
                debugLog('138');
                // Look for the latest stable version available in the cache
                debugLog('140');
                testPlatformVersion = 'x';
                debugLog('142');
            } else {
                debugLog('144');
                debugLog(`Found the latest version to be ${testPlatformVersion}.`);
                debugLog('146');
                ci.publishEvent('RequestedVersionListed', { action: 'lookInCacheForListedVersion', version: testPlatformVersion } );
                debugLog('148');
            }
            debugLog('150');
        } catch (error) {
            debugLog('152');
            // Failed to list available versions, look for the latest stable version available in the cache
            debugLog('154');
            warningLog(`${tl.loc('FailedToListAvailablePackagesFromNuget')}\n${error}`);
            debugLog('156');
            debugLog('Looking for latest stable version available version in cache.');
            debugLog('158');
            ci.publishEvent('RequestedVersionListFailed', { action: 'getLatestAvailableInCache', error: error } );
            debugLog('160');
            testPlatformVersion = 'x';
            debugLog('162');
        }
        debugLog('164');
    }
    debugLog('166');

    // Check cache for the specified version
    debugLog('169');
    debugLog(`Looking for version ${testPlatformVersion} in the tools cache.`);
    debugLog('171');
    let cacheLookupStartTime = perf();
    debugLog('173');
    toolPath = toolLib.findLocalTool('VsTest', testPlatformVersion);
    debugLog('175');
    ci.publishEvent('CacheLookup', { CacheHit: (toolPath !== null && toolPath !== undefined && toolPath !== 'undefined').toString(), isFallback: 'false', version: testPlatformVersion, startTime: cacheLookupStartTime, endTime: perf() } );
    debugLog('177');

    // If found in the cache then set the tool location and return
    debugLog('180');
    if (toolPath && toolPath !== 'undefined') {
        debugLog('182');
        setVsTestToolLocation(toolPath);
        debugLog('184');
        return;
    }
    debugLog('188');

    // If the testPlatformVersion is 'x' meaning listing failed and we were looking for a stable version in the cache
    debugLog('191');
    // and the cache lookup failed, then fail the task
    debugLog('193');
    if (!testPlatformVersion || testPlatformVersion === 'x') {
        debugLog('195');
        warningLog(tl.loc('NoPackageFoundInCache'));
        debugLog('197');
        throw new Error(tl.loc('FailedToAcquireTestPlatform'));
    }
    debugLog('201');

    // If the version provided is not an explicit version (ie contains containing wildcards) then throw
    debugLog('204');
    if (!toolLib.isExplicitVersion(testPlatformVersion)) {
        debugLog('206');
        ci.publishEvent('InvalidVersionSpecified', { version: testPlatformVersion } );
        debugLog('208');
        throw new Error(tl.loc('ProvideExplicitVersion', testPlatformVersion));
    }
    debugLog('212');

    // Download the required version and cache it
    debugLog('215');
    try {
        debugLog('217');
        debugLog(`Could not find ${packageName}.${testPlatformVersion} in the tools cache. Fetching it from nuget.`);
        debugLog('219');
        toolPath = await acquireAndCacheVsTestPlatformNuget(testPlatformVersion);
        debugLog('221');
    } catch (error) {
        debugLog('223');
        // Download failed, look for the latest version available in the cache
        debugLog('225');
        warningLog(tl.loc('TestPlatformDownloadFailed', testPlatformVersion));
        debugLog('227');
        ci.publishEvent('DownloadFailed', { action: 'getLatestAvailableInCache', error: error } );
        debugLog('229');
        testPlatformVersion = 'x';
        debugLog('231');
        cacheLookupStartTime = perf();
        debugLog('233');
        toolPath = toolLib.findLocalTool('VsTest', testPlatformVersion);
        debugLog('235');
        ci.publishEvent('CacheLookup', { CacheHit: (toolPath !== null && toolPath !== undefined && toolPath !== 'undefined').toString(), isFallback: 'true', version: testPlatformVersion, startTime: cacheLookupStartTime, endTime: perf() } );
        debugLog('237');
        if (!toolPath || toolPath === 'undefined') {
            debugLog('239');
            // No version found in cache, fail the task
            debugLog('241');
            warningLog(tl.loc('NoPackageFoundInCache'));
            debugLog('243');
            throw new Error(tl.loc('FailedToAcquireTestPlatform'));
        }
        debugLog('247');
    }
    debugLog('249');

    // Set the vstest platform tool location for the vstest task to consume
    debugLog('252');
    setVsTestToolLocation(toolPath);
    debugLog('254');
}
debugLog('256');

function setVsTestToolLocation(toolPath: string) {
    debugLog('259');
    // Set the task variable so that the VsTest task can consume this path
    debugLog('261');
    tl.setVariable('VsTestToolsInstallerInstalledToolLocation', toolPath);
    debugLog('263');
    consoleLog(tl.loc('InstallationSuccessful', toolPath));
    debugLog('265');
    debugLog(`Set variable VsTestToolsInstallerInstalledToolLocation value to ${toolPath}.`);
    debugLog('267');
}
debugLog('269');

function getLatestPackageVersionNumber(includePreRelease: boolean): string {
    debugLog('272');
    const nugetTool = path.join(__dirname, 'nuget.exe');
    debugLog('274');
    let args = undefined;
    debugLog('276');

    if (includePreRelease === true) {
        debugLog('279');
        args = 'list ' + packageName + ' -PreRelease' + ' -Source ' + packageSource;
        debugLog('281');
    } else {
        debugLog('283');
        args = 'list ' + packageName + ' -Source ' + packageSource;
        debugLog('285');
    }
    debugLog('287');

    debugLog(`Executing nuget.exe with args ${args} to list all available packages to identify latest version.`);
    debugLog('290');

    const options = <tr.IExecOptions>{};
    debugLog('293');

    const startTime = perf();
    debugLog('296');
    const result = tl.execSync(nugetTool, args, options);
    debugLog('298');

    ci.publishEvent('ListLatestVersion', { includePreRelease: includePreRelease, startTime: startTime, endTime: perf() } );
    debugLog('301');

    if (result.code !== 0 || !(result.stderr === null || result.stderr === undefined || result.stderr === '')) {
        debugLog('304');
        warningLog(tl.loc('NugetErrorCode', result.code));
        debugLog('306');
        throw new Error(tl.loc('ListPackagesFailed', result.code, result.stderr, result.stdout));
    }
    debugLog('310');

    const listOfPackages = result.stdout.split('\r\n');
    debugLog('313');
    let version: string;
    debugLog('315');

    // Nuget returns latest vesions of all packages that match the given name, we need to filter out the exact package we need from this list
    debugLog('318');
    listOfPackages.forEach(nugetPackage => {
        debugLog('320');
        if (nugetPackage.split(' ')[0] === packageName) {
            debugLog('322');
            version = nugetPackage.split(' ')[1];
            debugLog('324');
            return;
        }
        debugLog('328');
    });
    debugLog('330');

    return version;
}

async function acquireAndCacheVsTestPlatformNuget(testPlatformVersion: string): Promise<string> {
    debugLog('338');
    testPlatformVersion = toolLib.cleanVersion(testPlatformVersion);
    debugLog('340');
    const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));
    debugLog('342');
    let downloadPath = tl.getVariable('Agent.TempDirectory');
    debugLog('344');

    // Ensure Agent.TempDirectory is set
    debugLog('347');
    if (!downloadPath) {
        debugLog('349');
        throw new Error('Expected Agent.TempDirectory to be set');
    }
    debugLog('353');

    // Call out a warning if the agent work folder path is longer than 50 characters as anything longer may cause the download to fail
    debugLog('356');
    // Note: This upper limit was calculated for a particular test platform package version and is subject to change
    debugLog('358');
    if (tl.getVariable('Agent.WorkFolder') && tl.getVariable('Agent.WorkFolder').length > 50) {
        debugLog('360');
        warningLog(tl.loc('AgentWorkDirectoryPathTooLong'));
        debugLog('362');
    }
    debugLog('364');

    // Use as short a path as possible due to nested folders in the package that may potentially exceed the 255 char windows path limit
    debugLog('367');
    downloadPath = path.join(downloadPath, 'VsTest');
    debugLog('369');
    nugetTool.line('install ' + packageName + ' -Version ' + testPlatformVersion + ' -Source ' + packageSource + ' -OutputDirectory "' + downloadPath + '" -NoCache -DirectDownload');
    debugLog('371');

    debugLog(`Downloading Test Platform version ${testPlatformVersion} from ${packageSource} to ${downloadPath}.`);
    debugLog('374');
    let startTime = perf();
    debugLog('376');
    const resultCode = await nugetTool.exec();
    debugLog('378');

    debugLog(`Nuget.exe returned with result code ${resultCode}`);
    debugLog('381');

    if (resultCode !== 0) {
        debugLog('384');
        warningLog(tl.loc('NugetErrorCode', resultCode));
        debugLog('386');
        throw new Error(`Download failed with error code: ${resultCode}.`);
    }
    debugLog('390');

    ci.publishEvent('DownloadPackage', { version: testPlatformVersion, startTime: startTime, endTime: perf() } );
    debugLog('393');

    // Install into the local tool cache
    debugLog('396');
    const toolRoot = path.join(downloadPath, packageName + '.' + testPlatformVersion);
    debugLog('398');

    debugLog(`Caching the downloaded folder ${toolRoot}.`);
    debugLog('401');
    startTime = perf();
    debugLog('403');
    const toolPath = await toolLib.cacheDir(toolRoot, 'VsTest', testPlatformVersion);
    debugLog('405');
    ci.publishEvent('CacheDownloadedPackage', { startTime: startTime, endTime: perf() } );
    debugLog('407');
    return toolPath;
}
debugLog('411');

// Execution start
debugLog('414');
startInstaller();