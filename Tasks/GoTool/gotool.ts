import * as toolLib from 'vsts-task-tool-lib/tool';
import * as tl from 'vsts-task-lib/task';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';

let osPlat: string = os.platform();
let osArch: string = os.arch();

try {
    tl.setResourcePath(path.join(__dirname, "task.json"));
} catch (error) {
    tl.setResult(tl.TaskResult.Failed, error);
}

async function run() {
    try {
        let version = tl.getInput('version', true).trim();
        await getGo(version);
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }
}

async function getGo(version: string) {
    // check cache
    let toolPath: string;
    toolPath = toolLib.findLocalTool('go', version);

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
        throw (tl.loc("FailedToDownload", version, error));
    }

    //make sure agent version is latest then 2.115.0
    tl.assertAgent('2.115.0');

    //
    // Extract
    //
    let extPath: string;
    extPath = tl.getVariable('Agent.TempDirectory');
    if (!extPath) {
        throw new Error(tl.loc("TempDirNotSet"));
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
    let toolRoot = path.join(extPath, "go");
    return await toolLib.cacheDir(toolRoot, 'go', version);
}

function getFileName(version: string): string {
    let platform: string = osPlat == "win32" ? "windows" : osPlat;
    let arch: string = osArch == "x64" ? "amd64" : "386";
    let ext: string = osPlat == "win32" ? "zip" : "tar.gz";
    let filename: string = util.format("go%s.%s-%s.%s", version, platform, arch, ext);
    return filename;
}

function getDownloadUrl(filename: string): string {
    return util.format("https://storage.googleapis.com/golang/%s", filename);
}

function setGoEnvironmentVariables(goRoot: string) {

    let defaultDirectory = tl.getVariable('System.DefaultWorkingDirectory');
    tl.setVariable('GOROOT', goRoot);
}

run();