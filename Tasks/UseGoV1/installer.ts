import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as tl from 'azure-pipelines-task-lib/task';

import * as path from 'path';
import * as util from 'util';
import * as os from 'os';

const osPlat: string = os.platform();
const osArch: string = os.arch();

export async function getGo(version: string) {
    // check cache
    let toolPath: string;
    toolPath = toolLib.findLocalTool('go', normalizeVersion(version));

    if (!toolPath) {
        // download, extract, cache
        toolPath = await acquireGo(version);
        tl.debug("Go tool is cached under " + toolPath);
    }

    setGoEnvironmentVariables(toolPath);

    toolPath = path.join(toolPath, 'bin');
    //
    // prepend the tools path. instructs the agent to prepend for future tasks
    //
    toolLib.prependPath(toolPath);
}


async function acquireGo(version: string): Promise<string> {
    //
    // Download - a tool installer intimately knows how to get the tool (and construct urls)
    //
    let fileName: string = getFileName(version);
    let downloadUrl: string = getDownloadUrl(fileName);
    let downloadPath: string = null;
    try {
        downloadPath = await toolLib.downloadTool(downloadUrl);
    } catch (error) {
        tl.debug(error);

        throw (util.format("Failed to download version %s. Please verify that the version is valid. %s", version, error));
    }

    tl.assertAgent('2.115.0');

    //
    // Extract
    //
    let extPath: string = tl.getVariable('Agent.TempDirectory');
    if (!extPath) {
        throw new Error("Expected Agent.TempDirectory to be set");
    }

    if (osPlat == 'win32') {
        extPath = await toolLib.extractZip(downloadPath);
    }
    else {
        extPath = await toolLib.extractTar(downloadPath);
    }

    //
    // Install into the local tool cache - node extracts with a root folder that matches the fileName downloaded
    //
    const toolRoot = path.join(extPath, "go");
    version = normalizeVersion(version);
    return await toolLib.cacheDir(toolRoot, 'go', version);
}

function getFileName(version: string): string {
    const platform: string = osPlat == "win32" ? "windows" : osPlat;
    const arch: string = osArch == "x64" ? "amd64" : "386";
    const ext: string = osPlat == "win32" ? "zip" : "tar.gz";
    const filename: string = util.format("go%s.%s-%s.%s", version, platform, arch, ext);
    return filename;
}

function getDownloadUrl(filename: string): string {
    return util.format("https://storage.googleapis.com/golang/%s", filename);
}

function setGoEnvironmentVariables(goRoot: string) {
    tl.setVariable('GOROOT', goRoot);

    const goPath: string = tl.getInput("goPath", false);
    const goBin: string = tl.getInput("goBin", false);

    // set GOPATH and GOBIN as user value
    if (!util.isNullOrUndefined(goPath)) {
        tl.setVariable("GOPATH", goPath);
    }
    if (!util.isNullOrUndefined(goBin)) {
        tl.setVariable("GOBIN", goBin);
    }
}

// This function is required to convert the version 1.10 to 1.10.0.
// Because caching utility accept only sementic version,
// which have patch number as well.
function normalizeVersion(version: string): string {
    const versionPart = version.split(".");
    if(versionPart[1] == null) {
        //append minor and patch version if not available
        return version.concat(".0.0");
    }
    else if(versionPart[2] == null) {
        //append patch version if not available
        return version.concat(".0");
    } 
    return version;
}