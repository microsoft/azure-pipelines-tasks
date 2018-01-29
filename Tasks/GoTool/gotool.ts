///<reference path="../../definitions/node.d.ts" />

import * as toolLib from 'vsts-task-tool-lib/tool';
import * as tl from 'vsts-task-lib/task';
import * as os from 'os';
import * as path from 'path';

let osPlat: string = os.platform();
let osArch: string = os.arch();

try {
    tl.setResourcePath(path.join(__dirname, "task.json"));
} catch (error) {
    tl.setResult(tl.TaskResult.Failed, error);
}

async function run() {
    try {
        let versionSpec = tl.getInput('version', true);
        await getGo(versionSpec);
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
    setGoEnvironmentVariables(toolPath);
}


async function acquireGo(version: string): Promise<string> {
    //
    // Download - a tool installer intimately knows how to get the tool (and construct urls)
    //
    version = toolLib.cleanVersion(version);
    let fileName: string = getFileName(version);
    let downloadUrl: string = getDownloadUrl(fileName);
    let downloadPath: string = null;
    try {
        downloadPath = await toolLib.downloadTool(downloadUrl);
    } catch (error) {
        throw (tl.loc("VersionNotSupported", version));
    }

    //
    // Extract
    //
    let extPath: string;
    try {
        if (osPlat == 'win32') {
            tl.assertAgent('2.115.0');
            extPath = tl.getVariable('Agent.TempDirectory');
            if (!extPath) {
                throw new Error('Expected Agent.TempDirectory to be set');
            }
            extPath = await toolLib.extractZip(downloadPath);
        }
        else {
            extPath = await toolLib.extractTar(downloadPath);
            console.log("Extraction Path:= ", extPath);
        }
    } catch (error) {
        throw (error);
    }

    //
    // Install into the local tool cache - node extracts with a root folder that matches the fileName downloaded
    //
    let toolRoot = path.join(extPath, "go");
    console.log("tool root:= ", toolRoot);
    return await toolLib.cacheDir(toolRoot, 'go', version);
}

function getFileName(version: string): string {
    let platform: string = osPlat == "win32" ? "windows" : osPlat;
    let arch: string = osArch == "x64" ? "-amd64" : "-386";
    let ext: string = osPlat == "win32" ? ".zip" : ".tar.gz";
    let filename: string = "go" + version + "." + platform + arch + ext;
    return filename;
}

function getDownloadUrl(filename: string): string {
    return "https://storage.googleapis.com/golang/" + filename;
}

function setGoEnvironmentVariables(toolPath: string) {
    tl.debug("setting up GOROOT variable");
    let goRoot = toolPath;
    process.env['GOROOT'] = goRoot;
    tl.debug("GOROOT path is " + process.env['GOROOT']);

    tl.debug("setting up GOPATH variable");
    let agentBuildDir = tl.getVariable('Agent.BuildDirectory');
    process.env['GOPATH'] = agentBuildDir;
    tl.debug("GOPATH path is " + process.env['GOPATH']);

    tl.debug("setting up GOBIN variable");
    let goBin = path.join(agentBuildDir, "bin");
    process.env['GOBIN'] = goBin;
    tl.debug("GOBIN path is " + process.env['GOBIN']);

    // instruct the agent to set this path on future tasks
    console.log('##vso[task.setvariable variable=GOROOT]' + goRoot);
    console.log('##vso[task.setvariable variable=GOPATH]' + agentBuildDir);
    console.log('##vso[task.setvariable variable=GOBIN]' + goBin);
}

run();