import * as taskLib from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as trm from 'vsts-task-lib/toolrunner';
//import * as restm from 'typed-rest-client/RestClient';
import * as os from 'os';
import * as path from 'path';

async function run() {
    let packageType = taskLib.getInput('packageType', true);
    let version = taskLib.getInput('version', true).trim();
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
        toolPath = await acquireDotNetCore(packageType, version);
    }

    //
    // prepend the tools path. instructs the agent to prepend for future tasks
    //
    toolLib.prependPath(toolPath);
}

function getLocalTool(packageType: string, version:string): string {
    let cachedToolName = packageType === 'runtime' ? 'dncr' : 'dncs';
    return toolLib.findLocalTool(cachedToolName, version);
}

async function acquireDotNetCore(packageType: string, version: string): Promise<string> {
    let downloadUrls = getDownloadUrls(packageType, version);
    let downloadPath: string;

    try {
        if (!!downloadUrls[0]) {
            downloadPath = await toolLib.downloadTool(downloadUrls[0]);
        }
    } catch (error1) {
        console.log(taskLib.loc("PrimaryUrlDownloadFailed", error1));
        try {
            if (!!downloadUrls[1]) {
                downloadPath = await toolLib.downloadTool(downloadUrls[1]);
            }
        } catch (error2) {
            console.log(taskLib.loc("LegacyUrlDownloadFailed", error2));
            throw taskLib.loc("DownloadFailed");
        }
    }

    let extPath: string;
    if (taskLib.osType().match(/^Win/)) {
        extPath = await toolLib.extractZip(downloadPath);
    }
    else {
        extPath = await toolLib.extractTar(downloadPath);
    }

    let cachedToolName = packageType === 'runtime' ? 'dncr' : 'dncs';
    return await toolLib.cacheDir(extPath, cachedToolName, version);
}

function getDownloadUrls(packageType: string, version: string): string[] {
    let scriptRunner: trm.ToolRunner;
    if(taskLib.osType().match(/^Win/)) {
        let escapedScript = path.join(__dirname, 'externals', 'install-dotnet.ps1').replace(/'/g, "''");
        let command = `& '${escapedScript}' -Version ${version} -DryRun`
        if(packageType === 'runtime') {
            command = command.concat(" -SharedRuntime");
        }

        let powershellPath = taskLib.which('powershell', true);
        scriptRunner = taskLib.tool(powershellPath)
            .line('-NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command')
            .arg(command);
    } else {
        let escapedScript = path.join(__dirname, 'externals', 'install-dotnet.sh').replace(/'/g, "''");
        scriptRunner = taskLib.tool(taskLib.which(escapedScript, true));
        scriptRunner.arg('--version');
        scriptRunner.arg(version);
        scriptRunner.arg('--dry-run');
        if(packageType === 'runtime') {
            scriptRunner.arg('--shared-runtime');
        }
    }

    let result: trm.IExecSyncResult = scriptRunner.execSync();
    if(result.code != 0) {
        throw taskLib.loc("InstallScriptFailed", result.error ? result.error.message : result.stderr);
    }

    let output: string = result.stdout;

    let primaryUrl: string = null;
    let legacyUrl: string = null;
    let primaryUrlSearchString = "dotnet-install: Primary - ";
    let legacyUrlSearchString = "dotnet-install: Legacy - ";
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

    return [primaryUrl, legacyUrl];
}

var taskManifestPath = path.join(__dirname, "task.json");
taskLib.debug("Setting resource path to " + taskManifestPath);
taskLib.setResourcePath(taskManifestPath);

// TODO: Remove these
// taskLib.setVariable("Agent.ToolsDirectory", "C:\\work\\dotnetcore\\debugging\\_tools")
// taskLib.setVariable("Agent.TempDirectory", "C:\\work\\dotnetcore\\debugging\\_temp")
// taskLib.setVariable("Agent.Version", "2.115.0");

run().then((result) =>
   taskLib.setResult(taskLib.TaskResult.Succeeded, "")
).catch((error) =>
    taskLib.setResult(taskLib.TaskResult.Failed, !!error.message ? error.message : error)
);
