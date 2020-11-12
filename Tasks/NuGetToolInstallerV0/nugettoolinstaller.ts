import * as taskLib from 'azure-pipelines-task-lib/task';
import * as semver from 'semver';
import * as path from "path";
import * as telemetry from "utility-common/telemetry";

import nuGetGetter = require("packaging-common/nuget/NuGetToolGetter");

async function run() {
    let nugetVersion: string;
    let checkLatest: boolean;
    let nuGetPath: string;
    let msbuildSemVer: string;
    try {
        taskLib.setResourcePath(path.join(__dirname, "task.json"));

        let versionSpec = taskLib.getInput('versionSpec', false);
        if (!versionSpec) {
            msbuildSemVer = await nuGetGetter.getMSBuildVersionString();
            if (msbuildSemVer && semver.gte(msbuildSemVer, '16.5.0')) {
                taskLib.debug('Defaulting to 4.8.2 for msbuild version: ' + msbuildSemVer);
                versionSpec = '4.8.2';
            } else {
                versionSpec = '4.3.0';
            }
        }
        checkLatest = taskLib.getBoolInput('checkLatest', false);
        nuGetPath = await nuGetGetter.getNuGet(versionSpec, checkLatest, true);
    }
    catch (error) {
        console.error('ERR:' + error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, "");
    } finally {
        _logNugetToolInstallerStartupVariables(nugetVersion, checkLatest, nuGetPath, msbuildSemVer)
    }
}

function _logNugetToolInstallerStartupVariables(nugetVersion: string, 
    checkLatest: boolean, 
    nuGetPath: string,
    msBuildSemVer: any) {
    try {
        const telem = {
            "NUGET_EXE_TOOL_PATH_ENV_VAR": taskLib.getVariable(nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR),
            "isCheckLatestEnabled": checkLatest,
            "requestedNuGetVersionSpec": taskLib.getInput('versionSpec', false),
            "nuGetPath": nuGetPath,
            "nugetVersion": nugetVersion,
            "msBuildVersion": msBuildSemVer
        };
        telemetry.emitTelemetry("Packaging", "NuGetToolInstaller", telem);
    } catch (err) {
        taskLib.debug(`Unable to log NuGet Tool Installer task init telemetry. Err:(${err})`);
    }
}

run();