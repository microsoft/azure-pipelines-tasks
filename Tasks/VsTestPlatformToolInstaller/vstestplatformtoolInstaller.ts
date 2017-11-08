import tl = require('vsts-task-lib/task');
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as taskLib from 'vsts-task-lib/task';
import * as restm from 'typed-rest-client/RestClient';
import {IExecOptions, IExecSyncResult, ToolRunner} from "vsts-task-lib/toolrunner";
import * as os from 'os';
import * as path from 'path';

let osPlat: string = os.platform();
let packageName = 'Microsoft.TestPlatform';
let packageSource = 'https://dotnet.myget.org/F/vstest/api/v3/index.json'

async function startInstaller() {
    if (osPlat != 'win32') {
        throw new Error(tl.loc('OnlyWindowsOsSupported'));
    }

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        console.log(tl.loc('StartingInstaller'));
        console.log('==============================================================================');

        // Read inputs
        let versionSelectorInput = taskLib.getInput('versionSelector', true);
        let testPlatformVersion = taskLib.getInput('testPlatformVersion', false); 

        //TODO: Add an input for cleaning up the tool cache?
        
        // Get the required version of the platform and make necessary preparation to allow its consumption down the phase 
        await getVsTestPlatformTool(testPlatformVersion, versionSelectorInput);
    }
    catch (error) {
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

async function getVsTestPlatformTool(testPlatformVersion: string, versionSelectorInput: string) {
    // Should point to the location where the VsTest platform tool will be
    let toolPath: string;
    let includePreRelease: boolean;

    if (versionSelectorInput.toLowerCase() === 'lateststable') {
        includePreRelease = false;
    } 
    else if(versionSelectorInput == 'latestPreRelease') {
        includePreRelease = true;
    }

    if(versionSelectorInput.toLowerCase() != 'specificversion' || !testPlatformVersion) {
        try {
            testPlatformVersion = getLatestPackageVersionNumber(includePreRelease);
            tl.debug(`Found the latest version to be ${testPlatformVersion}`);
            if(testPlatformVersion == null) {
                throw new Error(tl.loc('FailedToListAvailableVersions'));
            }
        } catch(error) {
            // Failed to list available versions, look for the latest version available in the cache
            tl.warning(tl.loc('FailedToListAvailablePackagesFromNuget'));
            tl.debug('Looking for latest available version in cache');
            testPlatformVersion = 'x';
        }
    }

    // Check cache for the specified version
    tl.debug(`Looking for version ${testPlatformVersion} in the tools cache.`);
    toolPath = toolLib.findLocalTool('VsTest', testPlatformVersion);

    if (!toolPath && testPlatformVersion && testPlatformVersion != 'x') {
        tl.debug(`Could not find ${packageName}.${testPlatformVersion} in the tools cache. Fetching it from nuget.`);
        if (toolLib.isExplicitVersion(testPlatformVersion)) {
            // Download the required version and cache it
            try {
                toolPath = await acquireAndCacheVsTestPlatformNuget(testPlatformVersion);
            } catch(error) {
                // Download failed, look for the latest version available in the cache
                tl.warning(tl.loc('TestPlatformDownloadFailed', testPlatformVersion));
                testPlatformVersion = 'x';
                toolPath = toolLib.findLocalTool('VsTest', testPlatformVersion);
                if(!toolPath) {
                    // No version found in cache, fail the task
                    tl.warning(tl.loc('NoPackageFoundInCache'));
                    throw new Error(tl.loc('FailedToAcquireTestPlatform'));
                }
            }
        }
        else {
            throw new Error(tl.loc('ProvideExplicitVersion', testPlatformVersion));
        }
    }

    // Set the task variable so that the VsTest task can consume this path
    tl.setVariable('VsTestToolsInstallerInstalledToolLocation', toolPath);
    console.log(tl.loc('InstallationSuccessful', toolPath));
    tl.debug('Set variable VsTestToolsInstallerInstalledToolLocation value to ' + toolPath);
}

function getLatestPackageVersionNumber(includePreRelease: boolean): string {
    const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));

    if(includePreRelease == true) {
        nugetTool.line('list ' + packageName + ' -PreRelease' + ' -Source ' + packageSource);
    }
    else {
        nugetTool.line('list ' + packageName + ' -Source ' + packageSource);
    }

    let options= <IExecOptions>{};
    options.silent = true;
    var result = nugetTool.execSync(options);
    var listOfPackages = result.stdout.split('\n');
    var version: string;

    listOfPackages.forEach(nugetPackage => {
        if(nugetPackage.split(' ')[0] == packageName) {
            version = nugetPackage.split(' ')[1];
            return;
        }
    });

    return version;
}

async function acquireAndCacheVsTestPlatformNuget(testPlatformVersion: string): Promise<string> {
    testPlatformVersion = toolLib.cleanVersion(testPlatformVersion);
    const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));
    let downloadPath: string;
    
    downloadPath = taskLib.getVariable('Agent.TempDirectory');
    if (!downloadPath) {
        throw new Error('Expected Agent.TempDirectory to be set');
    }
    // use as short a path as possible due to nested folders in the package that may potentially exceed the 255 char windows path limit
    downloadPath = path.join(downloadPath, 'VsTest'); 
    nugetTool.line('install ' + packageName + ' -Version ' + testPlatformVersion + ' -Source ' + packageSource + ' -OutputDirectory ' + downloadPath);
    
    tl.debug(`Downloading Test Platform version ${testPlatformVersion} from ${packageSource} to ${downloadPath}.`);
    await nugetTool.exec();

    // Install into the local tool cache
    let toolRoot = path.join(downloadPath, packageName + '.' + testPlatformVersion);

    tl.debug(`Caching the downloaded folder ${toolRoot}.`);
    return await toolLib.cacheDir(toolRoot, 'VsTest', testPlatformVersion);
}

// Execution start
startInstaller();