import tl = require('vsts-task-lib/task');
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as taskLib from 'vsts-task-lib/task';
import * as restm from 'typed-rest-client/RestClient';
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
        console.log(tl.loc('StartingInstaller'));
        console.log('========================================================');

        // Read inputs
        let testPlatformVersion = taskLib.getInput('testPlatformVersion', true);
        let checkForLatestVersion: boolean = taskLib.getBoolInput('checkLatest', false);
        
        // Get the required version of the platform and make necessary preparation to allow its consumption down the phase 
        await getVsTestPlatformTool(testPlatformVersion, checkForLatestVersion);
    }
    catch (error) {
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

async function getVsTestPlatformTool(testPlatformVersion: string, checkForLatestVersion: boolean) {
    // Check cache for the specified version
    //taskLib.assertAgent('2.115.0');

    // Should point to the location where the VsTest platform tool will be
    let toolPath: string;

    if (!checkForLatestVersion) {
        tl.debug(`Check for latest version option was not ticked. Looking for ${testPlatformVersion} in the tools cache.`);
        toolPath = toolLib.findLocalTool('VsTest', testPlatformVersion);
    }
    else {
        // TODO: Code to find latest version and look for it in the cache anmd if not available in the cache then download and cache it. 
        tl.debug('Check for latest version option was ticked.');
    }

    if (!toolPath) {
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