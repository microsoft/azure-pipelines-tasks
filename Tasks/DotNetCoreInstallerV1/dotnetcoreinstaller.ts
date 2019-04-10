import * as path from 'path';

import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import { DotNetCoreVersionFetcher } from "./versionfetcher";
import { VersionInstaller } from "./versioninstaller";
import { Constants } from "./versionutilities";
import { VersionInfo, VersionParts } from "./models"

async function run() {
    let packageType = tl.getInput('packageType', true).toLowerCase();
    let versionSpec = tl.getInput('version', true);
    let installationPath = tl.getInput('installationPath', false);
    if (!installationPath) {
        installationPath = path.join(tl.getVariable('Agent.ToolsDirectory'), "dotnet");
    }
    let includePreviewVersions: boolean = tl.getBoolInput('includePreviewVersions', false) || false;

    console.log(tl.loc("ToolToInstall", packageType, versionSpec));
    var versionSpecParts = new VersionParts(versionSpec);

    let versionFetcher = new DotNetCoreVersionFetcher();
    let versionInfo: VersionInfo = await versionFetcher.getVersionInfo(versionSpecParts.versionSpec, packageType, includePreviewVersions);
    if (!versionInfo) {
        throw tl.loc("MatchingVersionNotFound", versionSpecParts.versionSpec);
    }

    let dotNetCoreInstaller = new VersionInstaller(packageType, installationPath);
    if (!dotNetCoreInstaller.isVersionInstalled(versionInfo.getVersion())) {
        await dotNetCoreInstaller.downloadAndInstall(versionInfo, versionFetcher.getDownloadUrl(versionInfo));
    }

    toolLib.prependPath(installationPath);

    // By default disable Multi Level Lookup unless user wants it enabled.
    let  performMultiLevelLookup = tl.getBoolInput("performMultiLevelLookup", false);
    tl.setVariable("DOTNET_MULTILEVEL_LOOKUP", !performMultiLevelLookup ? "0" : "1");

    // Add dot net tools path to "PATH" environment variables, so that tools can be used directly.
    addDotNetCoreToolPath();

    // Set DOTNET_ROOT for dotnet core Apphost to find runtime since it is installed to a non well-known location.
    tl.setVariable('DOTNET_ROOT', installationPath);
}

function addDotNetCoreToolPath() {
    try {
        let globalToolPath: string = "";
        if (tl.osType().match(/^Win/)) {
            globalToolPath = path.join(process.env.USERPROFILE, Constants.relativeGlobalToolPath);
        } else {
            globalToolPath = path.join(process.env.HOME, Constants.relativeGlobalToolPath);
        }

        console.log(tl.loc("PrependGlobalToolPath"));
        tl.mkdirP(globalToolPath);
        toolLib.prependPath(globalToolPath);
    } catch (error) {
        //nop
        console.log(tl.loc("ErrorWhileSettingDotNetToolPath", JSON.stringify(error)));
    }
}

var taskManifestPath = path.join(__dirname, "task.json");
tl.debug("Setting resource path to " + taskManifestPath);
tl.setResourcePath(taskManifestPath);

run()
    .then(() => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));