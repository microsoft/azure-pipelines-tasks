import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as tl from 'azure-pipelines-task-lib/task';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';
import * as telemetry from 'azure-pipelines-tasks-utility-common/telemetry';

let osPlat: string = os.platform();
let osArch: string = os.arch();

// Set resource path for localization
try {
    const taskManifestPath = path.join(__dirname, 'task.json');
    tl.debug('Setting resource path to ' + taskManifestPath);
    tl.setResourcePath(taskManifestPath);
} catch (e) {
    tl.debug('Failed to set resource path: ' + (e as any)?.message);
}

async function run() {
    try {
        const useGoMod: boolean = tl.getBoolInput('useGoMod', false);
        const workingDirectory: string = tl.getPathInput('workingDirectory', false) || tl.getVariable('System.DefaultWorkingDirectory') || process.cwd();

        if (useGoMod) {
            const versions = getVersionsFromGoMod(workingDirectory);
            if (!versions.length) {
                throw tl.loc('FailedToFindGoMod', workingDirectory);
            }
            for (const version of versions) {
                await getGo(version);
                telemetry.emitTelemetry('TaskHub', 'GoToolV0', { versionSource: 'go.mod', version });
            }
        } else {
            const versionInput = tl.getInput('version', true).trim();
            await getGo(versionInput);
            telemetry.emitTelemetry('TaskHub', 'GoToolV0', { versionSource: 'input', version: versionInput });
        }
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, error as any);
    }
}


// Recursively find go.mod files starting at workingDirectory and extract the go version directive.
// Returns distinct list of versions (without leading 'v').
function getVersionsFromGoMod(workingDirectory: string): string[] {
    const matches = tl.findMatch(workingDirectory, '**/go.mod');
    if (!matches || !matches.length) {
        return [];
    }

    const versions: Set<string> = new Set<string>();
    for (const filePath of matches) {
        tl.debug(`Found go.mod at ${filePath}`);
        try {
            const fileBuffer = fs.readFileSync(filePath);
            if (!fileBuffer.length) {
                tl.debug(`go.mod at ${filePath} is empty.`);
                continue;
            }
            const content = fileBuffer.toString();
            // Spec: a line starting with 'go ' followed by version (major.minor[.patch])
            // We purposely ignore toolchain directive for now.
            const regex = /^\s*go\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/m;
            const match = content.match(regex);
            if (match && match[1]) {
                let version = match[1].trim();
                tl.debug(`Parsed Go version '${version}' from ${filePath}`);
                tl.loc('GoModVersionDetected', version, filePath);
                versions.add(version);
            } else {
                tl.warning(tl.loc('GoModVersionNotFound', filePath));
            }
        } catch (err: any) {
            tl.warning(tl.loc('FailedToReadGoMod', filePath, err.message || err));
        }
    }
    return Array.from(versions.values());
}

async function getGo(version: string) {
    // check cache
    let toolPath: string;
    toolPath = toolLib.findLocalTool('go', fixVersion(version));

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

        // cannot localized the string here because to localize we need to set the resource file.
        // which can be set only once. azure-pipelines-tool-lib/tool, is already setting it to different file.
        // So left with no option but to hardcode the string. Other tasks are doing the same.
        throw (util.format("Failed to download version %s. Please verify that the version is valid and resolve any other issues. %s", version, error));
    }

    //make sure agent version is latest then 2.115.0
    tl.assertAgent('2.115.0');

    //
    // Extract
    //
    let extPath: string;
    extPath = tl.getVariable('Agent.TempDirectory');
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
    let toolRoot = path.join(extPath, "go");
    version = fixVersion(version);
    return await toolLib.cacheDir(toolRoot, 'go', version);
}

function getFileName(version: string): string {
    let platform: string = osPlat == "win32" ? "windows" : osPlat;
    let arch: string;
    if (osArch == "x64") {
        arch = "amd64";
    } else if (osArch == "arm64") {
        arch = "arm64";
    } else {
        arch = "386";
    }
    let ext: string = osPlat == "win32" ? "zip" : "tar.gz";
    let filename: string = util.format("go%s.%s-%s.%s", version, platform, arch, ext);
    return filename;
}

function getDownloadUrl(filename: string): string {
    return util.format("https://go.dev/dl/%s", filename);
}

function setGoEnvironmentVariables(goRoot: string) {
    tl.setVariable('GOROOT', goRoot);

    let goPath: string = tl.getInput("goPath", false);
    let goBin: string = tl.getInput("goBin", false);

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
function fixVersion(version: string): string {
    let versionPart = version.split(".");
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

run();