import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as trm from 'vsts-task-lib/toolrunner';
import { DotNetCoreReleaseFetcher } from "./releasesfetcher";
import * as utilities from "./utilities";
import * as fileSystem from "fs";

import * as os from 'os';
import * as path from 'path';

class DotnetCoreInstaller {
    constructor(packageType: string, version?: string, useGlobalJson: boolean = false) {
        this.useGlobalJson = useGlobalJson;
        this.packageType = packageType;
        if (!toolLib.isExplicitVersion(version)) {
            throw tl.loc("ImplicitVersionNotSupported", version);
        }
        this.version = version;
        this.cachedToolName = this.packageType === 'runtime' ? 'dncr' : 'dncs';;
    }

    private async installFromGlobalJson(osSuffixes: string[]) {
        let filePathsToGlobalJson = this.getFiles(".", "global.json");
        let sdkVersionNumber = new Array<{ name: string, toolPath?: string }>();
        // read all global files
        filePathsToGlobalJson.forEach(filePath => {
            let globalJson = (JSON.parse(fileSystem.readFileSync(filePath).toString())) as { sdk: { version: string } };
            sdkVersionNumber.push({ name: globalJson.sdk.version, toolPath: null });
        });
        // check each version if it installed in the cache
        sdkVersionNumber.forEach(d => {
            let path = this.getLocalTool(d.name);
            d.toolPath = path;
        });

        // download all sdk that are not in the cache
        await sdkVersionNumber
            .filter(d => d.toolPath == null)
            .forEach(async d => {
                // download, extract, cache
                console.log(tl.loc("InstallingAfresh"));
                console.log(tl.loc("GettingDownloadUrl", this.packageType, d.name));
                let downloadUrls = await DotNetCoreReleaseFetcher.getDownloadUrls(osSuffixes, d.name, this.packageType);
                d.toolPath = await this.downloadAndInstall(downloadUrls);
                // Prepend the tools path. instructs the agent to prepend for future tasks
                toolLib.prependPath(d.toolPath);
            });

        // set the biggest sdk as default
        let biggestSdkVersion = sdkVersionNumber.sort((a,b) => a.name.localeCompare(b.name))[sdkVersionNumber.length - 1];
        tl.setVariable('DOTNET_ROOT', biggestSdkVersion.toolPath);
    }

    private async installFromInputParameter(osSuffixes: string[]) {
        let toolPath = this.getLocalTool();

        if (!toolPath) {
            // download, extract, cache
            console.log(tl.loc("InstallingAfresh"));
            console.log(tl.loc("GettingDownloadUrl", this.packageType, this.version));
            let downloadUrls = await DotNetCoreReleaseFetcher.getDownloadUrls(osSuffixes, this.version, this.packageType);
            toolPath = await this.downloadAndInstall(downloadUrls);
        } else {
            console.log(tl.loc("UsingCachedTool", toolPath));
        }

        // Prepend the tools path. instructs the agent to prepend for future tasks
        toolLib.prependPath(toolPath);
    }

    public async install() {
        // Check cache
        let toolPath: string; // TODO: remove me
        let osSuffixes = this.detectMachineOS();
        let parts = osSuffixes[0].split("-");
        this.arch = parts.length > 1 ? parts[1] : "x64";

        if (this.useGlobalJson) {
            await this.installFromGlobalJson(osSuffixes);
        } else {
            await this.installFromInputParameter(osSuffixes);
        }        
        try {
            let globalToolPath: string = "";
            if (tl.osType().match(/^Win/)) {
                globalToolPath = path.join(process.env.USERPROFILE, ".dotnet\\tools");
            } else {
                globalToolPath = path.join(process.env.HOME, ".dotnet/tools");
            }

            console.log(tl.loc("PrependGlobalToolPath"));
            tl.mkdirP(globalToolPath);
            toolLib.prependPath(globalToolPath);
        } catch (error) {
            //nop
        }

        // Set DOTNET_ROOT for dotnet core Apphost to find runtime since it is installed to a non well-known location.
        tl.setVariable('DOTNET_ROOT', toolPath);
    }

    private getLocalTool(version?: string): string | null {
        console.log(tl.loc("CheckingToolCache"));
        return toolLib.findLocalTool(
            this.cachedToolName,
            version != null ? version : this.version,
            this.arch);
    }

    private detectMachineOS(): string[] {
        let osSuffix = [];
        let scriptRunner: trm.ToolRunner;

        if (tl.osType().match(/^Win/)) {
            let escapedScript = path.join(utilities.getCurrentDir(), 'externals', 'get-os-platform.ps1').replace(/'/g, "''");
            let command = `& '${escapedScript}'`

            let powershellPath = tl.which('powershell', true);
            scriptRunner = tl.tool(powershellPath)
                .line('-NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command')
                .arg(command);
        }
        else {
            let scriptPath = path.join(utilities.getCurrentDir(), 'externals', 'get-os-distro.sh');
            utilities.setFileAttribute(scriptPath, "777");

            scriptRunner = tl.tool(tl.which(scriptPath, true));
        }

        let result: trm.IExecSyncResult = scriptRunner.execSync();

        if (result.code != 0) {
            throw tl.loc("getMachinePlatformFailed", result.error ? result.error.message : result.stderr);
        }

        let output: string = result.stdout;

        let index;
        if ((index = output.indexOf("Primary:")) >= 0) {
            let primary = output.substr(index + "Primary:".length).split(os.EOL)[0];
            osSuffix.push(primary);
            console.log(tl.loc("PrimaryPlatform", primary));
        }

        if ((index = output.indexOf("Legacy:")) >= 0) {
            let legacy = output.substr(index + "Legacy:".length).split(os.EOL)[0];
            osSuffix.push(legacy);
            console.log(tl.loc("LegacyPlatform", legacy));
        }

        if (osSuffix.length == 0) {
            throw tl.loc("CouldNotDetectPlatform");
        }

        return osSuffix;
    }

    private async downloadAndInstall(downloadUrls: string[]) {
        let downloaded = false;
        let downloadPath = "";
        for (const url of downloadUrls) {
            try {
                downloadPath = await toolLib.downloadTool(url);
                downloaded = true;
                break;
            } catch (error) {
                tl.warning(tl.loc("CouldNotDownload", url, JSON.stringify(error)));
            }
        }

        if (!downloaded) {
            throw tl.loc("FailedToDownloadPackage");
        }

        // extract
        console.log(tl.loc("ExtractingPackage", downloadPath));
        let extPath: string = tl.osType().match(/^Win/) ? await toolLib.extractZip(downloadPath) : await toolLib.extractTar(downloadPath);

        // cache tool
        console.log(tl.loc("CachingTool"));
        let cachedDir = await toolLib.cacheDir(extPath, this.cachedToolName, this.version, this.arch);
        console.log(tl.loc("SuccessfullyInstalled", this.packageType, this.version));
        return cachedDir;
    }

    /**
     * Search for files from a given path.
     * @param dir the dir we use to search for files
     * @param searchPattern the regex search pattern the file name must match. The default matches on all names!
     */
    private getFiles(dir: string, searchPattern: string = ".*", recursive: boolean = true): Array<string> {
        const subPaths = fileSystem.readdirSync(dir);
        let matchedFiles = new Array<string>();
        for (const subPath of subPaths) {
            const res = path.resolve(dir, subPath);
            if (
                (fileSystem.statSync(res)).isDirectory() &&
                recursive) {
                matchedFiles = matchedFiles.concat(this.getFiles(res, searchPattern));
            } else {
                if (res.match(searchPattern)) {
                    matchedFiles.push(res);
                }
            }
        }
        return matchedFiles;
    }

    private packageType: string;
    private version?: string;
    private useGlobalJson: boolean = false;
    private cachedToolName: string;
    private arch: string;
}

async function run() {
    let packageType = tl.getInput('packageType', true);
    let version = tl.getInput('version', true).trim();
    console.log(tl.loc("ToolToInstall", packageType, version));
    await new DotnetCoreInstaller(packageType, version).install();
}

var taskManifestPath = path.join(__dirname, "task.json");
tl.debug("Setting resource path to " + taskManifestPath);
tl.setResourcePath(taskManifestPath);

run()
    .then(() => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));