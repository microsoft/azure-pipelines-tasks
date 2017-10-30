//import toolLib = require('vsts-task-tool-lib/tool');
import tl = require('vsts-task-lib/task');
//import taskLib = require('vsts-task-lib/task');
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as taskLib from 'vsts-task-lib/task';
import * as restm from 'typed-rest-client/RestClient';
import * as os from 'os';
import * as path from 'path';

let osPlat: string = os.platform();
let osArch: string = os.arch();

async function run() {
    try {
        tl.warning("Starting");
        let versionSpec = taskLib.getInput('versionSpec', true);
        tl.warning("Version " + versionSpec);
        let checkLatest: boolean = taskLib.getBoolInput('checkLatest', false);
        tl.warning("CheckLatest " + checkLatest);
        await getNode(versionSpec, checkLatest);
    }
    catch (error) {
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

//
// Basic pattern:
//      if !checkLatest
//          toolPath = check cache
//      if !toolPath
//          if version is a range
//              match = query nodejs.org
//              if !match
//                  fail
//              toolPath = check cache
//          if !toolPath
//              download, extract, and cache
//              toolPath = cacheDir
//      PATH = cacheDir + PATH
//
async function getNode(versionSpec: string, checkLatest: boolean) {
    

    // check cache
    let toolPath: string;
    if (!checkLatest) {
        toolPath = toolLib.findLocalTool('vstestplatform', versionSpec);
    }

    if (!toolPath) {
        let version: string;
        if (toolLib.isExplicitVersion(versionSpec)) {
            // version to download
            version = versionSpec;
        }
        else {
                throw new Error(`Unable to find VsTest Platform version '${versionSpec}' for platform ${osPlat} and architecture ${osArch}.`);
        }

        if (!toolPath) {
            // download, extract, cache
            tl.warning("acquire node");
            toolPath = await acquireNode(version);
        }
    }

    //
    // a tool installer initimately knows details about the layout of that tool
    // for example, node binary is in the bin folder after the extract on Mac/Linux.
    // layouts could change by version, by platform etc... but that's the tool installers job
    //
    if (osPlat != 'win32') {
        toolPath = path.join(toolPath, 'bin');
    }

    //
    // prepend the tools path. instructs the agent to prepend for future tasks
    //
    toolLib.prependPath(toolPath);
}

async function acquireNode(version: string): Promise<string> {
    //
    // Download - a tool installer intimately knows how to get the tool (and construct urls)
    //
    version = toolLib.cleanVersion(version);
    let fileName: string = "Microsoft.TestPlatform." + version + ".zip"

    //let downloadUrl = 'https://dotnet.myget.org/F/vstest/api/v2/package/Microsoft.TestPlatform/' + version;
    let downloadUrl = 'https://www.nuget.org/api/v2/package/Newtonsoft.Json/' + version;

    let downloadPath: string = await toolLib.downloadTool(downloadUrl, fileName);

    //
    // Extract
    //
    let extPath: string;
    if (osPlat == 'win32') {
        taskLib.assertAgent('2.115.0');
        extPath = taskLib.getVariable('Agent.TempDirectory');
        if (!extPath) {
            throw new Error('Expected Agent.TempDirectory to be set');
        }

        extPath = path.join(extPath, 'v'); // use as short a path as possible due to nested node_modules folders
        extPath = await toolLib.extract7z(downloadPath, extPath);
    }

    //
    // Install into the local tool cache - node extracts with a root folder that matches the fileName downloaded
    //
    let toolRoot = path.join(extPath, fileName);
    toolLib.prependPath(toolRoot);
    return await toolLib.cacheDir(toolRoot, 'vstestplatform', version);
}

run();
