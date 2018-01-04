import * as taskLib from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as trm from 'vsts-task-lib/toolrunner';
import * as utils from "./utilities";

import * as os from 'os';
import * as path from 'path';

async function run() {
    let packageType = taskLib.getInput('packageType', true);
    let version = taskLib.getInput('version', true).trim();
    console.log(taskLib.loc("ToolToInstall", packageType, version));
    await getDotnetCore(packageType, version);
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
}

function getCachedToolName(packageType: string): string {
    // use short names to not unnecessarily run into path limit issues
    return packageType === 'runtime' ? 'dncr' : 'dncs';
}

function getLocalTool(packageType: string, version:string): string {
    console.log(taskLib.loc("CheckingToolCache"));
    let cachedToolName = getCachedToolName(packageType);
    return toolLib.findLocalTool(cachedToolName, version);
}

async function acquireDotNetCore(packageType: string, version: string): Promise<string> {
    let downloadUrls = getDownloadUrls(packageType, version);
    let downloadPath: string;

    try {
        // try primary url
        if (!!downloadUrls[0]) {
            console.log(taskLib.loc("DownloadingPrimaryUrl", downloadUrls[0]));
            downloadPath = await toolLib.downloadTool(downloadUrls[0]);
        }
    } catch (error1) {
        console.log(taskLib.loc("PrimaryUrlDownloadFailed", error1));
        try {
            // try secondary url
            if (!!downloadUrls[1]) {
                console.log(taskLib.loc("DownloadingSecondaryUrl", downloadUrls[1]));
                downloadPath = await toolLib.downloadTool(downloadUrls[1]);
            }
        } catch (error2) {
            console.log(taskLib.loc("LegacyUrlDownloadFailed", error2));
            throw taskLib.loc("DownloadFailed", packageType, version);
        }
    }

    // extract
    let extPath: string;
    console.log(taskLib.loc("ExtractingPackage", downloadPath));
    if (taskLib.osType().match(/^Win/)) {
        extPath = await toolLib.extractZip(downloadPath);
    }
    else {
        extPath = await toolLib.extractTar(downloadPath);
    }

    // cache tool
    let cachedToolName = getCachedToolName(packageType);
    console.log(taskLib.loc("CachingTool"));
    let cachedDir =  await toolLib.cacheDir(extPath, cachedToolName, version);
    console.log(taskLib.loc("SuccessfullyInstalled", packageType, version));
    return cachedDir;
}

function getDownloadUrls(packageType: string, version: string): string[] {
    let scriptRunner: trm.ToolRunner;
    let primaryUrlSearchString: string;
    let legacyUrlSearchString: string;

    console.log(taskLib.loc("GettingDownloadUrls", packageType, version));
    if(taskLib.osType().match(/^Win/)) {
        let escapedScript = path.join(utils.getCurrentDir(), 'externals', 'install-dotnet.ps1').replace(/'/g, "''");
        let command = `& '${escapedScript}' -Version ${version} -DryRun`
        if(packageType === 'runtime') {
            command = command.concat(" -SharedRuntime");
        }

        let powershellPath = taskLib.which('powershell', true);
        scriptRunner = taskLib.tool(powershellPath)
            .line('-NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command')
            .arg(command);

        primaryUrlSearchString = "dotnet-install: Primary - ";
        legacyUrlSearchString = "dotnet-install: Legacy - ";
    } else {
        let escapedScript = path.join(utils.getCurrentDir(), 'externals', 'install-dotnet.sh').replace(/'/g, "''");
        utils.setFileAttribute(escapedScript, "777");
        scriptRunner = taskLib.tool(taskLib.which(escapedScript, true));
        scriptRunner.arg('--version');
        scriptRunner.arg(version);
        scriptRunner.arg('--dry-run');
        if(packageType === 'runtime') {
            scriptRunner.arg('--shared-runtime');
        }

        primaryUrlSearchString = "dotnet-install: Payload URL: ";
        legacyUrlSearchString = "dotnet-install: Legacy payload URL: ";
    }

    let result: trm.IExecSyncResult = scriptRunner.execSync();
    if(result.code != 0) {
        throw taskLib.loc("getDownloadUrlsFailed", result.error ? result.error.message : result.stderr);
    }

    let output: string = result.stdout;

    let primaryUrl: string = null;
    let legacyUrl: string = null;
    if(!!output && output.length > 0) {
        let lines: string[] = output.split(os.EOL);
        if(!!lines && lines.length > 0) {
            lines.forEach((line: string) => {
                if(!line) { return; }
                var primarySearchStringIndex = line.indexOf(primaryUrlSearchString);
                if(primarySearchStringIndex > -1) {
                    primaryUrl = line.substring(primarySearchStringIndex + primaryUrlSearchString.length);
                    return;
                }

                var legacySearchStringIndex = line.indexOf(legacyUrlSearchString);
                if(legacySearchStringIndex > -1) {
                    legacyUrl = line.substring(legacySearchStringIndex + legacyUrlSearchString.length);
                    return;
                }
            });
        }
    }

    if(!primaryUrl && !legacyUrl) {
        throw taskLib.loc("NullDownloadUrls");
    }

    return [primaryUrl, legacyUrl];
}

var taskManifestPath = path.join(__dirname, "task.json");
taskLib.debug("Setting resource path to " + taskManifestPath);
taskLib.setResourcePath(taskManifestPath);

run().then((result) =>
   taskLib.setResult(taskLib.TaskResult.Succeeded, "")
).catch((error) =>
    taskLib.setResult(taskLib.TaskResult.Failed, !!error.message ? error.message : error)
);
