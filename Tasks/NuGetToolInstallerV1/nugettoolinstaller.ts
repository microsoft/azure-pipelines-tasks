import * as taskLib from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as nuGetGetter from 'packaging-common/nuget/NuGetToolGetter';
import * as telemetry from "utility-common/telemetry";

const DEFAULT_NUGET_VERSION = '>=4.9';

async function run() {
    let versionSpec: string;
    let checkLatest: boolean;
    let nuGetPath: string;
    try {
        taskLib.setResourcePath(path.join(__dirname, 'task.json'));

        versionSpec = taskLib.getInput('versionSpec', false) || DEFAULT_NUGET_VERSION;
        checkLatest = taskLib.getBoolInput('checkLatest', false);
        nuGetPath = await nuGetGetter.getNuGet(versionSpec, checkLatest, true);
    } catch (error) {
        console.error('ERR:' + error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, '');
    } finally {
        _logNugetToolInstallerStartupVariables(versionSpec, checkLatest, nuGetPath)
    }
}

function _logNugetToolInstallerStartupVariables(versionSpec: string, checkLatest: boolean, nuGetPath: string) {
    try {
        const telem = {
            "NUGET_EXE_TOOL_PATH_ENV_VAR": taskLib.getVariable(nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR),
            "isCheckLatestEnabled": checkLatest,
            "nuGetPath": nuGetPath,
            "requestedNuGetVersionSpec": versionSpec
        };
        telemetry.emitTelemetry("Packaging", "NuGteToolInstaller", telem);
    } catch (err) {
        taskLib.debug(`Unable to log NuGet Tool Installer task init telemetry. Err:(${err})`);
    }
}

run();