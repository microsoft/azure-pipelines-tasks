import * as taskLib from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as restm from 'typed-rest-client/RestClient';
import * as os from 'os';
import * as path from 'path';

let osPlat: string = os.platform();
let osArch: string = os.arch();

async function run() {
    try {
        let versionSpec = taskLib.getInput('versionSpec', true);
        let checkLatest: boolean = taskLib.getBoolInput('checkLatest', false);
        await getNode(versionSpec, checkLatest);
    }
    catch (error) {
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

//
// Node versions interface
// see https://nodejs.org/dist/index.json
//
interface INodeVersion {
    version: string,
    files: string[]
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
    if (toolLib.isExplicitVersion(versionSpec)) {
        checkLatest = false; // check latest doesn't make sense when explicit version
    }

    // check cache
    let toolPath: string;
    if (!checkLatest) {
        toolPath = toolLib.findLocalTool('node', versionSpec);
    }

    if (!toolPath) {
        let version: string;
        if (toolLib.isExplicitVersion(versionSpec)) {
            // version to download
            version = versionSpec;
        }
        else {
            // query nodejs.org for a matching version
            version = await queryLatestMatch(versionSpec);
            if (!version) {
                throw new Error(`Unable to find Node version '${versionSpec}' for platform ${osPlat} and architecture ${osArch}.`);
            }

            // check cache
            toolPath = toolLib.findLocalTool('node', version)
        }

        if (!toolPath) {
            // download, extract, cache
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

async function queryLatestMatch(versionSpec: string): Promise<string> {
    // node offers a json list of versions
    let dataFileName: string;
    switch (osPlat) {
        case "linux": dataFileName = "linux-" + osArch; break;
        case "darwin": dataFileName = "osx-" + osArch + '-tar'; break;
        case "win32": dataFileName = "win-" + osArch + '-exe'; break;
        default: throw new Error(`Unexpected OS '${osPlat}'`);
    }

    let versions: string[] = [];
    let dataUrl = "https://nodejs.org/dist/index.json";
    let rest: restm.RestClient = new restm.RestClient('vsts-node-tool');
    let nodeVersions: INodeVersion[] = (await rest.get<INodeVersion[]>(dataUrl)).result;
    nodeVersions.forEach((nodeVersion:INodeVersion) => {
        // ensure this version supports your os and platform
        if (nodeVersion.files.indexOf(dataFileName) >= 0) {
            versions.push(nodeVersion.version);
        }
    });

    // get the latest version that matches the version spec
    let version: string = toolLib.evaluateVersions(versions, versionSpec);
    return version;
}

async function acquireNode(version: string): Promise<string> {
    //
    // Download - a tool installer intimately knows how to get the tool (and construct urls)
    //
    version = toolLib.cleanVersion(version);
    let fileName: string = osPlat == 'win32'? 'node-v' + version + '-win-' + os.arch() :
                                                'node-v' + version + '-' + osPlat + '-' + os.arch();  
    let urlFileName: string = osPlat == 'win32'? fileName + '.7z':
                                                    fileName + '.tar.gz';  

    let downloadUrl = 'https://nodejs.org/dist/v' + version + '/' + urlFileName;

    let downloadPath: string;

    try 
    {
        downloadPath = await toolLib.downloadTool(downloadUrl);
    } 
    catch (err)
    {
        if (err['httpStatusCode'] && 
            err['httpStatusCode'] == '404')
        {
            return await acquireNodeFromFallbackLocation(version);
        }

        throw err;
    }
    
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

        let _7zPath = path.join(__dirname, '7zr.exe');
        extPath = await toolLib.extract7z(downloadPath, extPath, _7zPath);
    }
    else {
        extPath = await toolLib.extractTar(downloadPath);
    }

    //
    // Install into the local tool cache - node extracts with a root folder that matches the fileName downloaded
    //
    let toolRoot = path.join(extPath, fileName);
    return await toolLib.cacheDir(toolRoot, 'node', version);
}

// For non LTS versions of Node, the files we need (for Windows) are sometimes located
// in a different folder than they normally are for other versions.
// Normally the format is similar to: https://nodejs.org/dist/v5.10.1/node-v5.10.1-win-x64.7z
// In this case, there will be two files located at:
//      /dist/v5.10.1/win-x64/node.exe
//      /dist/v5.10.1/win-x64/node.lib
// This method attempts to download and cache the resources from this alternative location.
// Note also that the files are normally zipped but in this case they are just an exe
// and lib file in a folder, not zipped.
async function acquireNodeFromFallbackLocation(version: string): Promise<string> {
    let exeUrl: string = `https://nodejs.org/dist/v${version}/win-${os.arch()}/node.exe`;
    let libUrl: string = `https://nodejs.org/dist/v${version}/win-${os.arch()}/node.lib`;

    // Create temporary folder to download in to
    let tempDownloadFolder: string = 'temp_' + Math.floor(Math.random() * 2000000000);
    let tempDir: string = path.join(taskLib.getVariable('agent.tempDirectory'), tempDownloadFolder);
    taskLib.mkdirP(tempDir);

    let exeDownloadPath: string = await toolLib.downloadTool(exeUrl, path.join(tempDir, "node.exe"));
    let libDownloadPath: string = await toolLib.downloadTool(libUrl, path.join(tempDir, "node.lib"));

    return await toolLib.cacheDir(tempDir, 'node', version);
}

run();
