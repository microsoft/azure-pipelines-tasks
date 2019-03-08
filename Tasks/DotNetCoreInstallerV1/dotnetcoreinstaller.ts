import * as path from 'path';

import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import { DotNetCoreVersionFetcher, VersionInfo } from "./versionFetcher";
import { VersionInstaller } from "./versionInstaller";

async function run() {
    let packageType = tl.getInput('packageType', true);
    let version = tl.getInput('version', true).trim();
    let installationPath = tl.getInput('installationPath', true).trim();
    let includePreviewVersions: boolean = tl.getBoolInput('includePreviewVersions', true);
    console.log(tl.loc("ToolToInstall", packageType, version));
    let versionFetcher = new DotNetCoreVersionFetcher();

    let versionInfo: VersionInfo = await versionFetcher.getVersionInfo(version, packageType, includePreviewVersions);
    if (!versionInfo) {
        throw tl.loc("MatchingVersionNotFound", version);
    }

    let dotNetCoreInstaller = new VersionInstaller(packageType, installationPath);
    if (!dotNetCoreInstaller.isVersionInstalled(versionInfo.version)) {
        await dotNetCoreInstaller.downloadAndInstall(versionInfo, versionFetcher.getDownloadUrl(versionInfo, packageType));
    }

    // By default disable Multi Level Lookup unless user wants it enabled.
    if (tl.getBoolInput("restrictMultiLevelLookup", true)) {
        tl.setVariable("DOTNET_MULTILEVEL_LOOKUP", "0");
    }

    addDotNetCoreToolPath();

    // Set DOTNET_ROOT for dotnet core Apphost to find runtime since it is installed to a non well-known location.
    tl.setVariable('DOTNET_ROOT', installationPath);
}

function addDotNetCoreToolPath() {
    // Add dot net tools path to "PATH" environment variables, so that tools can be used directly.
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
}

var taskManifestPath = path.join(__dirname, "task.json");
tl.debug("Setting resource path to " + taskManifestPath);
tl.setResourcePath(taskManifestPath);

run()
    .then(() => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));