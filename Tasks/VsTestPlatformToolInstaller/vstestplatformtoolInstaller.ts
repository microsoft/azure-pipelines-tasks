import tl = require('vsts-task-lib/task');
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as taskLib from 'vsts-task-lib/task';
import * as restm from 'typed-rest-client/RestClient';
import * as os from 'os';
import * as path from 'path';

let osPlat: string = os.platform();
let osArch: string = os.arch();

async function startInstaller() {
    try {
        console.log("Starting the VsTestPlatform tools installer task");
        console.log('========================================================');

        // Read inputs
        let testPlatformVersion = taskLib.getInput('testPlatformVersion', true);
        let checkForLatestVersion: boolean = taskLib.getBoolInput('checkLatest', false);
        
        await getVsTestPlatformTool(testPlatformVersion, checkForLatestVersion);
    }
    catch (error) {
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

async function getVsTestPlatformTool(testPlatformVersion: string, checkForLatestVersion: boolean) {
    // Check cache for the specified version
    let toolPath: string;
    if (!checkForLatestVersion) {
        toolPath = toolLib.findLocalTool('VsTest', testPlatformVersion);
    }

    if (!toolPath) {
        let version: string;
        if (toolLib.isExplicitVersion(testPlatformVersion)) {
            // version to download
            version = testPlatformVersion;
        }
        else {
            throw new Error(`Unable to find VsTest Platform version '${testPlatformVersion}' for platform ${osPlat} and architecture ${osArch}.`);
        }

        if (!toolPath) {
            // download, extract, cache
            toolPath = await acquireAndCacheVsTestPlatformNuget(version);
        }
    }

    // Set the task variable so that the VsTest task can consume this path
    tl.setVariable('VsTestToolsInstallerInstalledToolLocation', toolPath);
    tl.debug('Set task variable VsTestToolsInstallerInstalledToolLocation value to ' + toolPath);
}

async function acquireAndCacheVsTestPlatformNuget(testPlatformVersion: string): Promise<string> {

    testPlatformVersion = toolLib.cleanVersion(testPlatformVersion);
    let packageName = 'Microsoft.TestPlatform';
    let packageSource = 'https://dotnet.myget.org/F/vstest/api/v3/index.json'
    const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));
    let downloadPath: string;

    if (osPlat == 'win32') {
        taskLib.assertAgent('2.115.0');
        downloadPath = taskLib.getVariable('Agent.TempDirectory');
        if (!downloadPath) {
            throw new Error('Expected Agent.TempDirectory to be set');
        }
        // use as short a path as possible due to nested folders in the package that may potentially exceed the 255 char windows path limit
        downloadPath = path.join(downloadPath, 'VsTest'); 
        nugetTool.line('install ' + packageName + ' -Version ' + testPlatformVersion + ' -Source ' + packageSource + ' -OutputDirectory ' + downloadPath);
        await nugetTool.exec();
    }
 
    // Install into the local tool cache
    let toolRoot = path.join(downloadPath, packageName + '.' + testPlatformVersion);
    return await toolLib.cacheDir(toolRoot, 'VsTest', testPlatformVersion);
}

// Execution start
startInstaller();