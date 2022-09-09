import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as telemetry from 'azure-pipelines-tasks-utility-common/telemetry';
import * as restm from 'typed-rest-client/RestClient';
import * as ifm from 'typed-rest-client/Interfaces';
import * as os from 'os';
import * as path from 'path';

const osPlat: string = os.platform();
// Don't use `os.arch()` to construct download URLs,
// Node.js uses a different set of arch identifiers for those.
const force32bit: boolean = taskLib.getBoolInput('force32bit', false);
const osArch: string = (os.arch() === 'ia32' || force32bit) ? 'x86' : os.arch();

//
// Node versions interface
// see https://nodejs.org/dist/index.json
//
interface INodeVersion {
    version: string,
    files: string[],
    semanticVersion: string
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
export async function getNode(versionSpec: string, checkLatest: boolean) {
    let installedArch = osArch;

    if (toolLib.isExplicitVersion(versionSpec)) {
        checkLatest = false; // check latest doesn't make sense when explicit version
    }

    // check cache
    let toolPath: string;
    if (!checkLatest) {
        toolPath = toolLib.findLocalTool('node', versionSpec, installedArch);

        // In case if it's darwin arm and toolPath is empty trying to find x64 version
        if (!toolPath && isDarwinArm(osPlat, installedArch)) {
            toolPath = toolLib.findLocalTool('node', versionSpec, 'x64');
        }
    }

    if (!toolPath) {
        let version: string;
        if (toolLib.isExplicitVersion(versionSpec)) {
            // version to download
            version = versionSpec;
        } else {
            // query nodejs.org for a matching version
            version = await queryLatestMatch(versionSpec, installedArch);

            if (!version && isDarwinArm(osPlat, installedArch)) {
                // nodejs.org does not have an arm64 build for macOS, so we fall back to x64
                console.log(taskLib.loc('TryRosetta', osPlat, installedArch));

                version = await queryLatestMatch(versionSpec, 'x64');
                installedArch = 'x64';
            }

            if (!version) {
                throw new Error(taskLib.loc('NodeVersionNotFound', versionSpec, osPlat, installedArch));
            }

            // check cache
            toolPath = toolLib.findLocalTool('node', version, installedArch)
        }

        if (!toolPath) {
            // download, extract, cache
            toolPath = await acquireNode(version, installedArch);
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
    telemetry.emitTelemetry('TaskHub', 'UseNodeV1', {
        versionSpec,
        checkLatest,
        force32bit
    });
}

async function queryLatestMatch(versionSpec: string, installedArch: string): Promise<string> {
    // node offers a json list of versions
    let dataFileName: string;
    switch (osPlat) {
        case 'linux': dataFileName = 'linux-' + installedArch; break;
        case 'darwin': dataFileName = 'osx-' + installedArch + '-tar'; break;
        case 'win32': dataFileName = 'win-' + installedArch + '-exe'; break;
        default: throw new Error(taskLib.loc('UnexpectedOS', osPlat));
    }

    const versions: string[] = [];
    const dataUrl = 'https://nodejs.org/dist/index.json';
    const proxyRequestOptions: ifm.IRequestOptions = {
        proxy: taskLib.getHttpProxyConfiguration(dataUrl),
        cert: taskLib.getHttpCertConfiguration(),
        ignoreSslError: !!taskLib.getVariable('Agent.SkipCertValidation')
    };
    const rest: restm.RestClient = new restm.RestClient('vsts-node-tool', undefined, undefined, proxyRequestOptions);
    const nodeVersions: INodeVersion[] = (await rest.get<INodeVersion[]>(dataUrl)).result;
    nodeVersions.forEach((nodeVersion:INodeVersion) => {
        // ensure this version supports your os and platform
        if (nodeVersion.files.indexOf(dataFileName) >= 0) {
            // versions in the file are prefixed with 'v', which is not valid SemVer
            // remove 'v' so that toolLib.evaluateVersions behaves properly
            nodeVersion.semanticVersion = toolLib.cleanVersion(nodeVersion.version);
            versions.push(nodeVersion.semanticVersion);
        }
    });

    // get the latest version that matches the version spec
    const latestVersion: string = toolLib.evaluateVersions(versions, versionSpec);
     // In case if that we had not found version that match 
    if (!latestVersion) return null;
    
    return nodeVersions.find(v => v.semanticVersion === latestVersion).version;
}

async function acquireNode(version: string, installedArch: string): Promise<string> {
    //
    // Download - a tool installer intimately knows how to get the tool (and construct urls)
    //
    version = toolLib.cleanVersion(version);
    const fileName: string = osPlat === 'win32' ? 'node-v' + version + '-win-' + installedArch :
                                                  'node-v' + version + '-' + osPlat + '-' + installedArch;
    const urlFileName: string = osPlat === 'win32' ? fileName + '.7z':
                                                     fileName + '.tar.gz';

    const downloadUrl = 'https://nodejs.org/dist/v' + version + '/' + urlFileName;

    let downloadPath: string;
    try {
        downloadPath = await toolLib.downloadTool(downloadUrl);
    } 
    catch (err) {
        if (err['httpStatusCode'] && 
            err['httpStatusCode'] === '404') {
            return await acquireNodeFromFallbackLocation(version);
        }

        throw err;
    }
    
    //
    // Extract
    //
    let extPath: string;
    if (osPlat === 'win32') {
        extPath = taskLib.getVariable('Agent.TempDirectory');
        if (!extPath) {
            throw new Error(taskLib.loc('AgentTempDirNotSet'));
        }

        const _7zPath = path.join(__dirname, '7zr.exe');
        extPath = await toolLib.extract7z(downloadPath, extPath, _7zPath);
    }
    else {
        extPath = await toolLib.extractTar(downloadPath);
    }

    //
    // Install into the local tool cache - node extracts with a root folder that matches the fileName downloaded
    //
    const toolRoot = path.join(extPath, fileName);
    return await toolLib.cacheDir(toolRoot, 'node', version, installedArch);
}

// For non LTS versions of Node, the files we need (for Windows) are sometimes located
// in a different folder than they normally are for other versions.
// Normally the format is similar to: https://nodejs.org/dist/v5.10.1/node-v5.10.1-win-x64.7z
// In this case, there will be two files located at:
//      /dist/v5.10.1/win-x64/node.exe
//      /dist/v5.10.1/win-x64/node.lib
// If this is not the structure, there may also be two files located at:
//      /dist/v0.12.18/node.exe
//      /dist/v0.12.18/node.lib
// This method attempts to download and cache the resources from these alternative locations.
// Note also that the files are normally zipped but in this case they are just an exe
// and lib file in a folder, not zipped.
async function acquireNodeFromFallbackLocation(version: string): Promise<string> {
    // Create temporary folder to download in to
    const tempDownloadFolder: string = 'temp_' + Math.floor(Math.random() * 2e9);
    const tempDir: string = path.join(taskLib.getVariable('agent.tempDirectory'), tempDownloadFolder);
    taskLib.mkdirP(tempDir);

    let exeUrl: string;
    let libUrl: string;
    try {
        exeUrl = `https://nodejs.org/dist/v${version}/win-${osArch}/node.exe`;
        libUrl = `https://nodejs.org/dist/v${version}/win-${osArch}/node.lib`;

        await toolLib.downloadTool(exeUrl, path.join(tempDir, 'node.exe'));
        await toolLib.downloadTool(libUrl, path.join(tempDir, 'node.lib'));
    }
    catch (err) {
        if (err['httpStatusCode'] && 
            err['httpStatusCode'] === '404') {
            exeUrl = `https://nodejs.org/dist/v${version}/node.exe`;
            libUrl = `https://nodejs.org/dist/v${version}/node.lib`;

            await toolLib.downloadTool(exeUrl, path.join(tempDir, 'node.exe'));
            await toolLib.downloadTool(libUrl, path.join(tempDir, 'node.lib'));
        }
        else {
            throw err;
        }
    }
    return await toolLib.cacheDir(tempDir, 'node', version, osArch);
}

// Check is the system are darwin arm and rosetta is installed
function isDarwinArm(osPlat: string, installedArch: string): boolean {
    if (osPlat === 'darwin' && installedArch === 'arm64') {
        // Check that Rosetta is installed and returns some pid
        const execResult = taskLib.execSync('pgrep', 'oahd');
        return execResult.code === 0 && !!execResult.stdout;
    }
    return false;
}