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
    let useGlobalJson: boolean = taskLib.getBoolInput('useGlobalJson');
    let versionSpec = taskLib.getInput('version');
    const nugetVersion = taskLib.getInput('nugetVersion') || '4.4.1';

    // Check if we want install dotnet
    if (versionSpec || useGlobalJson) {
        let packageType = taskLib.getInput('packageType') || "sdk";
        let installationPath = taskLib.getInput('installationPath');
        let includePreviewVersions: boolean = taskLib.getBoolInput('includePreviewVersions');
        let workingDirectory: string | null = taskLib.getPathInput("workingDirectory", false) || null;
        let performMultiLevelLookup = taskLib.getBoolInput("performMultiLevelLookup", false);
        installDotNet(installationPath, packageType, versionSpec, useGlobalJson, workingDirectory, includePreviewVersions, performMultiLevelLookup);
    }
    // Install NuGet version specified by user or 4.4.1 in case none is specified
    // Also sets up the proxy configuration settings.    
    await NuGetInstaller.installNuGet(nugetVersion);
}

/**
 * install dotnet to the installation path.
 * @param installationPath The installation path. If this is empty it would use {Agent.ToolsDirectory}/dotnet/
 * @param packageType The installation type for the installation. Only `sdk` and `runtime` are valid options
 * @param versionSpec The version the user want to install.
 * @param useGlobalJson A switch so we know if the user have `global.json` files and want use that.
 * @param workingDirectory This is only relevant if the `useGlobalJson` switch is `true`. It will set the root directory for the search of `global.json`
 * @param includePreviewVersions Define if the installer also search for preview version
 * @param performMultiLevelLookup Set the `DOTNET_MULTILEVEL_LOOKUP`environment variable
 */
async function installDotNet(
    installationPath: string,
    packageType: string,
    versionSpec: string | null,
    useGlobalJson: boolean,
    workingDirectory: string | null,
    includePreviewVersions: boolean,
    performMultiLevelLookup: boolean) {

    if (!installationPath && installationPath.length == 0) {
        installationPath = path.join(taskLib.getVariable('Agent.ToolsDirectory'), "dotnet");
    }
    if (useGlobalJson) {
        let globalJsonFetcherInstance = new globalJsonFetcher(workingDirectory);
        let versionsToInstall: VersionInfo[] = await globalJsonFetcherInstance.Get(packageType);
        let dotNetCoreInstaller = new VersionInstaller(packageType, installationPath);
        versionsToInstall = versionsToInstall.filter(d => !dotNetCoreInstaller.isVersionInstalled(d.getVersion()));
        dotNetCoreInstaller.downloadAndInstallVersions(versionsToInstall);
    } else if (versionSpec) {
        console.log(taskLib.loc("ToolToInstall", packageType, versionSpec));
        let versionSpecParts = new VersionParts(versionSpec);
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

    taskLib.prependPath(installationPath);
    // Set DOTNET_ROOT for dotnet core Apphost to find runtime since it is installed to a non well-known location.
    taskLib.setVariable('DOTNET_ROOT', installationPath);
    // By default disable Multi Level Lookup unless user wants it enabled.
    taskLib.setVariable("DOTNET_MULTILEVEL_LOOKUP", !performMultiLevelLookup ? "0" : "1");
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