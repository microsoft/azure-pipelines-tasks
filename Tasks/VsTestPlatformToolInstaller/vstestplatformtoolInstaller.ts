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

    if (versionSelectorInput == 'latestStable') {
        testPlatformVersion = getLatestPackageVersionNumber(false);

        if(testPlatformVersion == null) {
            throw new Error(tl.loc('CouldNotFindLatestStableVersion', packageName));
        }

        tl.debug(`Found the latest stable version to be ${testPlatformVersion}`);
    } 
    else if(versionSelectorInput == 'latestPreRelease') {
        testPlatformVersion = getLatestPackageVersionNumber(true);

        if(testPlatformVersion == null) {
            throw new Error(tl.loc('CouldNotFindLatestPreReleaseVersion', packageName));
        }

        tl.debug(`Found the latest pre-release version to be ${testPlatformVersion}`);
    }

    // Check cache for the specified version
    tl.debug(`Looking for ${testPlatformVersion} in the tools cache.`);
    toolPath = toolLib.findLocalTool('VsTest', testPlatformVersion);

    if (!toolPath) {
        tl.debug(`Could not find ${packageName}.${testPlatformVersion} in the tools cache. Fetching it from nuget.`);
        if (toolLib.isExplicitVersion(testPlatformVersion)) {
            // Download the required version and cache it
            toolPath = await acquireAndCacheVsTestPlatformNuget(testPlatformVersion);
        }
        else {
            throw new Error(tl.loc('ProvideExplicitVersion', testPlatformVersion));
        }
    }

    // Set the task variable so that the VsTest task can consume this path
    tl.setVariable('VsTestToolsInstallerInstalledToolLocation', toolPath);
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