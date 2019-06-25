"use strict";
import * as path from 'path';

import * as taskLib from 'azure-pipelines-task-lib/task';
import { DotNetCoreVersionFetcher } from "./versionfetcher";
import { globalJsonFetcher } from "./globaljsonfetcher";
import { VersionInstaller } from "./versioninstaller";
import { Constants } from "./versionutilities";
import { VersionInfo, VersionParts } from "./models"
import { NuGetInstaller } from "./nugetinstaller";

async function run() {
    let packageType = taskLib.getInput('packageType') || "sdk";
    let versionSpec = taskLib.getInput('version');
    let installationPath = taskLib.getInput('installationPath');
    if (!installationPath) {
        installationPath = path.join(taskLib.getVariable('Agent.ToolsDirectory'), "dotnet");
    }
    let includePreviewVersions: boolean = taskLib.getBoolInput('includePreviewVersions');
    let useGlobalJson: boolean = taskLib.getBoolInput('useGlobalJson');
    let workingDirectory: string | null = taskLib.getPathInput("workingDirectory", false) || null;
    if (useGlobalJson) {
        var globalJsonFetcherInstance = new globalJsonFetcher(workingDirectory);
        var versionsToInstall: VersionInfo[] = await globalJsonFetcherInstance.Get(packageType);
        let dotNetCoreInstaller = new VersionInstaller(packageType, installationPath);
        versionsToInstall = versionsToInstall.filter(d => !dotNetCoreInstaller.isVersionInstalled(d.getVersion()));
        dotNetCoreInstaller.downloadAndInstallVersions(versionsToInstall);
    } else if (versionSpec) {
        console.log(taskLib.loc("ToolToInstall", packageType, versionSpec));
        var versionSpecParts = new VersionParts(versionSpec);

        let versionFetcher = new DotNetCoreVersionFetcher();
        let versionInfo: VersionInfo = await versionFetcher.getVersionInfo(versionSpecParts.versionSpec, packageType, includePreviewVersions);
        if (!versionInfo) {
            throw taskLib.loc("MatchingVersionNotFound", versionSpecParts.versionSpec);
        }

        let dotNetCoreInstaller = new VersionInstaller(packageType, installationPath);
        if (!dotNetCoreInstaller.isVersionInstalled(versionInfo.getVersion())) {
            await dotNetCoreInstaller.downloadAndInstall(versionInfo, versionFetcher.getDownloadUrl(versionInfo));
        }
    }

    if (versionSpec || useGlobalJson) {
        taskLib.prependPath(installationPath);
        // Set DOTNET_ROOT for dotnet core Apphost to find runtime since it is installed to a non well-known location.
        taskLib.setVariable('DOTNET_ROOT', installationPath);
        
        // By default disable Multi Level Lookup unless user wants it enabled.
        let performMultiLevelLookup = taskLib.getBoolInput("performMultiLevelLookup", false);

        taskLib.setVariable("DOTNET_MULTILEVEL_LOOKUP", !performMultiLevelLookup ? "0" : "1");
    }
    // Install NuGet version specified by user or 4.4.1 in case none is specified
    // Also sets up the proxy configuration settings.
    const nugetVersion = taskLib.getInput('nugetVersion') || '4.4.1';
    await NuGetInstaller.installNuGet(nugetVersion);
    // Add dot net tools path to "PATH" environment variables, so that tools can be used directly.
    addDotNetCoreToolPath();


}

function addDotNetCoreToolPath() {
    try {
        let globalToolPath: string = "";
        if (taskLib.osType().match(/^Win/)) {
            globalToolPath = path.join(process.env.USERPROFILE, Constants.relativeGlobalToolPath);
        } else {
            globalToolPath = path.join(process.env.HOME, Constants.relativeGlobalToolPath);
        }

        console.log(taskLib.loc("PrependGlobalToolPath"));
        taskLib.mkdirP(globalToolPath);
        taskLib.prependPath(globalToolPath);
    } catch (error) {
        //nop
        console.log(taskLib.loc("ErrorWhileSettingDotNetToolPath", JSON.stringify(error)));
    }
}

var taskManifestPath = path.join(__dirname, "task.json");
taskLib.debug("Setting resource path to " + taskManifestPath);
taskLib.setResourcePath(taskManifestPath);

run()
    .then(() => taskLib.setResult(taskLib.TaskResult.Succeeded, ""))
    .catch((error) => taskLib.setResult(taskLib.TaskResult.Failed, !!error.message ? error.message : error));