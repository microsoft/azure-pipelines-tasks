import * as taskLib from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as trm from 'vsts-task-lib/toolrunner';
import * as utils from "./utilities";
import { DotNetCoreReleaseFetcher } from "./DotnetCoreReleasesFetcher";

import * as os from 'os';
import * as path from 'path';

async function run() {
    let packageType = taskLib.getInput('packageType', true);
    let version = taskLib.getInput('version', true).trim();
    console.log(taskLib.loc("ToolToInstall", packageType, version));
    await getDotnetCore(packageType, version);
}

function getMachinePlatform(): string[] {
    if (taskLib.osType().match(/^Win/)) {
        return ["win-x64"];
    }
    else {
        let escapedScript = path.join(utils.getCurrentDir(), 'externals', 'get-os-distro.sh').replace(/'/g, "''");
        utils.setFileAttribute(escapedScript, "777");
        let scriptRunner: trm.ToolRunner = taskLib.tool(taskLib.which(escapedScript, true));

        let result: trm.IExecSyncResult = scriptRunner.execSync();
        if (result.code != 0) {
            throw taskLib.loc("getMachinePlatformFailed", result.error ? result.error.message : result.stderr);
        }

        let output: string = result.stdout;
        let primarySearchString: string = "Primary:";
        let legacySearchString: string = "Legacy:";
        let primaryPlatform: string = null;
        let legacyPlatform: string = null;
        if (!!output && output.length > 0) {
            let lines: string[] = output.split(os.EOL);
            if (!!lines && lines.length > 0) {
                lines.forEach((line: string) => {
                    if (!line) { return; }
                    var primarySearchStringIndex = line.indexOf(primarySearchString);
                    if (primarySearchStringIndex > -1) {
                        primaryPlatform = line.substring(primarySearchStringIndex + primarySearchString.length);
                        return;
                    }

                    var legacySearchStringIndex = line.indexOf(legacySearchString);
                    if (legacySearchStringIndex > -1) {
                        legacyPlatform = line.substring(legacySearchStringIndex + legacySearchString.length);
                        return;
                    }
                });
            }
        }

        if (!primaryPlatform && !legacyPlatform) {
            throw taskLib.loc("NullDownloadUrls");
        }

        return [primaryPlatform, legacyPlatform];
    }
}


async function getDotnetCore(packageType: string, version: string): Promise<void> {
    if (!toolLib.isExplicitVersion(version)) {
        throw taskLib.loc("ImplicitVersionNotSupported", version);
    }

    // check cache
    let toolPath: string;
    toolPath = getLocalTool(packageType, version);

    if (!toolPath) {
        // download, extract, cache
        console.log(taskLib.loc("InstallingAfresh"));
        toolPath = await acquireDotNetCore(packageType, version);
    } else {
        console.log(taskLib.loc("UsingCachedTool", toolPath));
    }

    // prepend the tools path. instructs the agent to prepend for future tasks
    toolLib.prependPath(toolPath);
    // set DOTNET_ROOT for dotnet core Apphost to find runtime since it is installed to a non well-known location.
    taskLib.setVariable('DOTNET_ROOT', toolPath);
}

function getCachedToolName(packageType: string): string {
    // use short names to not unnecessarily run into path limit issues
    return packageType === 'runtime' ? 'dncr' : 'dncs';
}

function getLocalTool(packageType: string, version: string): string {
    console.log(taskLib.loc("CheckingToolCache"));
    let cachedToolName = getCachedToolName(packageType);
    return toolLib.findLocalTool(cachedToolName, version);
}

async function acquireDotNetCore(packageType: string, version: string): Promise<string> {
    let platforms = getMachinePlatform();
    console.log(taskLib.loc("PrimaryPlatform", platforms[0]));
    if (!!platforms[1]) {
        console.log(taskLib.loc("LegacyPlatform", platforms[1]));
    }

    console.log(taskLib.loc("GettingDownloadUrl", packageType, version));
    let downloadUrl = await new DotNetCoreReleaseFetcher().getDownloadUrl(platforms, version, packageType);
    let downloadPath: string;

    if (!!downloadUrl) {
        console.log(taskLib.loc("DownloadingUrl", downloadUrl));
        downloadPath = await toolLib.downloadTool(downloadUrl);

        // extract
        let extPath: string;
        console.log(taskLib.loc("ExtractingPackage", downloadPath));
        if (taskLib.osType().match(/^Win/)) {
            extPath = await toolLib.extractZip(downloadPath);

        } else {
            extPath = await toolLib.extractTar(downloadPath);
        }

        // cache tool
        let cachedToolName = getCachedToolName(packageType);
        console.log(taskLib.loc("CachingTool"));
        let cachedDir = await toolLib.cacheDir(extPath, cachedToolName, version);
        console.log(taskLib.loc("SuccessfullyInstalled", packageType, version));
        return cachedDir;
    }
}

var taskManifestPath = path.join(__dirname, "task.json");
taskLib.debug("Setting resource path to " + taskManifestPath);
taskLib.setResourcePath(taskManifestPath);

run().then((result) =>
    taskLib.setResult(taskLib.TaskResult.Succeeded, "")
).catch((error) =>
    taskLib.setResult(taskLib.TaskResult.Failed, !!error.message ? error.message : error)
    );