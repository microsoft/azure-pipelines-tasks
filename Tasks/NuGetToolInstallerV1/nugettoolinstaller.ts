import * as taskLib from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as nuGetGetter from 'azure-pipelines-tasks-packaging-common/nuget/NuGetToolGetter';
import * as peParser from "azure-pipelines-tasks-packaging-common/pe-parser";
import {VersionInfo} from "azure-pipelines-tasks-packaging-common/pe-parser/VersionResource";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";

const DEFAULT_NUGET_VERSION = '>=4.9';

async function run() {
    let nugetVersion: string;
    let checkLatest: boolean;
    let nuGetPath: string;
    let msBuildSemVer: string;
    try {
        taskLib.setResourcePath(path.join(__dirname, 'task.json'));

        const versionSpec = taskLib.getInput('versionSpec', false) || DEFAULT_NUGET_VERSION;
        checkLatest = taskLib.getBoolInput('checkLatest', false);
        nuGetPath = await nuGetGetter.getNuGet(versionSpec, checkLatest, true);

        const nugetVersionInfo: VersionInfo = await peParser.getFileVersionInfoAsync(nuGetPath);
        if (nugetVersionInfo && nugetVersionInfo.fileVersion){
            nugetVersion = nugetVersionInfo.fileVersion.toString();
        }

        msBuildSemVer = await nuGetGetter.getMSBuildVersionString();
    } catch (error) {
        console.error('ERR:' + error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, '');
    } finally {
        _logNugetToolInstallerStartupVariables(nugetVersion, checkLatest, nuGetPath, msBuildSemVer)
    }
}

function _logNugetToolInstallerStartupVariables(nugetVersion: string, 
    checkLatest: boolean, 
    nuGetPath: string,
    msBuildSemVer: string) {
    try {
        const telem = {
            "NUGET_EXE_TOOL_PATH_ENV_VAR": taskLib.getVariable(nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR),
            "DEFAULT_NUGET_VERSION": DEFAULT_NUGET_VERSION,
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