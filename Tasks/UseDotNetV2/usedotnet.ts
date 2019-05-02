"use strict";
import * as path from 'path';

import * as tl from 'azure-pipelines-task-lib/task';

import { DotNetCoreVersionFetcher } from "./versionfetcher";
import { VersionInstaller } from "./versioninstaller";
import { Constants } from "./versionutilities";
import { VersionInfo, VersionParts } from "./models"
import { NuGetInstaller } from "./nugetinstaller";

async function run() {
    let packageType = tl.getInput('packageType') || "sdk";
    let versionSpec = tl.getInput('version');
    if (versionSpec) {
        console.log(tl.loc("ToolToInstall", packageType, versionSpec));
        let installationPath = tl.getInput('installationPath');
        if (!installationPath) {
            installationPath = path.join(tl.getVariable('Agent.ToolsDirectory'), "dotnet");
        }
        let includePreviewVersions: boolean = tl.getBoolInput('includePreviewVersions');

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

        tl.prependPath(installationPath);

        // Set DOTNET_ROOT for dotnet core Apphost to find runtime since it is installed to a non well-known location.
        tl.setVariable('DOTNET_ROOT', installationPath);

        // By default disable Multi Level Lookup unless user wants it enabled.
        let performMultiLevelLookup = tl.getBoolInput("performMultiLevelLookup", false);
        tl.setVariable("DOTNET_MULTILEVEL_LOOKUP", !performMultiLevelLookup ? "0" : "1");
    }

    // Install NuGet version specified by user or 4.4.1 in case none is specified
    // Also sets up the proxy configuration settings.
    const nugetVersion = tl.getInput('nugetVersion') || '4.4.1';
    await NuGetInstaller.installNuGet(nugetVersion);

    // Add dot net tools path to "PATH" environment variables, so that tools can be used directly.
    addDotNetCoreToolPath();
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
        tl.prependPath(globalToolPath);
    } catch (error) {
        //nop
        console.log(tl.loc("ErrorWhileSettingDotNetToolPath", JSON.stringify(error)));
    }
}

const taskManifestPath = path.join(__dirname, "task.json");
const packagingCommonManifestPath = path.join(__dirname, "node_modules/packaging-common/module.json");
tl.debug("Setting resource path to " + taskManifestPath);
tl.setResourcePath(taskManifestPath);
tl.setResourcePath(packagingCommonManifestPath);

run()
    .then(() => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));