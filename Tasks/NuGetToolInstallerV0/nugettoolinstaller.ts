import * as taskLib from 'azure-pipelines-task-lib/task';
import * as semver from 'semver';
import * as path from "path";
import * as peParser from "azure-pipelines-tasks-packaging-common/pe-parser";
import {VersionInfo} from "azure-pipelines-tasks-packaging-common/pe-parser/VersionResource";
import {emitTelemetry} from "azure-pipelines-tasks-artifacts-common/telemetry";

import nuGetGetter = require("azure-pipelines-tasks-packaging-common/nuget/NuGetToolGetter");

async function run() {
    let nugetVersion: string;
    let checkLatest: boolean;
    let nuGetPath: string;
    let msbuildSemVer: semver.SemVer;
    try {
        taskLib.setResourcePath(path.join(__dirname, "task.json"));

        let versionSpec = taskLib.getInput('versionSpec', false);
        if (!versionSpec) {
            msbuildSemVer = await nuGetGetter.getMSBuildVersion();
            if (msbuildSemVer && semver.gte(msbuildSemVer, '16.8.0')) {
                taskLib.debug('Defaulting to 5.8.0 for msbuild version: ' + msbuildSemVer);
                versionSpec = '5.8.0';
            } else if (msbuildSemVer && semver.gte(msbuildSemVer, '16.5.0')) {
                taskLib.debug('Defaulting to 4.8.2 for msbuild version: ' + msbuildSemVer);
                versionSpec = '4.8.2';
            } else {
                versionSpec = '4.3.0';
            }
        }
        checkLatest = taskLib.getBoolInput('checkLatest', false);
        nuGetPath = await nuGetGetter.getNuGet(versionSpec, checkLatest, true);

        const nugetVersionInfo: VersionInfo = await peParser.getFileVersionInfoAsync(nuGetPath);
        if (nugetVersionInfo && nugetVersionInfo.fileVersion){
            nugetVersion = nugetVersionInfo.fileVersion.toString();
        }

    }
    catch (error) {
        console.error('ERR:' + error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, "");
    } finally {
        _logNugetToolInstallerStartupVariables(nugetVersion, checkLatest, nuGetPath, msbuildSemVer);
    }
}

function _logNugetToolInstallerStartupVariables(
    nugetVersion: string,
    checkLatest: boolean,
    nuGetPath: string,
    msbuildSemVer: semver.SemVer) {
    try {
        const telem = {
            "NUGET_EXE_TOOL_PATH_ENV_VAR": taskLib.getVariable(nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR),
            "isCheckLatestEnabled": checkLatest,
            "requestedNuGetVersionSpec": taskLib.getInput('versionSpec', false),
            "nuGetPath": nuGetPath,
            "nugetVersion": nugetVersion,
            "msBuildVersion": msbuildSemVer && msbuildSemVer.toString()
        };
        emitTelemetry("Packaging", "NuGetToolInstaller", telem);
    } catch (err) {
        taskLib.debug(`Unable to log NuGet Tool Installer task init telemetry. Err:(${err})`);
    }
}

run();