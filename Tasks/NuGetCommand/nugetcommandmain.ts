import * as tl from "vsts-task-lib/task";
import * as path from "path";

import * as nugetRestore from './nugetrestore';
import * as nugetPublish from './nugetpublisher';
import * as nugetPack from './nugetpack';
import * as nugetCustom from './nugetcustom';
import nuGetGetter = require("nuget-task-common/NuGetToolGetter");

const NUGET_EXE_CUSTOM_LOCATION: string = "NuGetExeCustomLocation";

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    // Getting NuGet
    tl.debug('Getting NuGet');
    let nuGetPath: string = undefined;
    try {
        nuGetPath = tl.getVariable(nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR) || tl.getVariable(NUGET_EXE_CUSTOM_LOCATION);
        if (!nuGetPath){
            let cachedVersionToUse = nuGetGetter.DEFAULT_NUGET_VERSION;
            nuGetGetter.cacheBundledNuGet();
            if (tl.getVariable(nuGetGetter.FORCE_NUGET_4_0_0) &&
                tl.getVariable(nuGetGetter.FORCE_NUGET_4_0_0).toLowerCase() === "true") {
                cachedVersionToUse = nuGetGetter.NUGET_VERSION_4_0_0;
            }
            nuGetPath = await nuGetGetter.getNuGet(cachedVersionToUse);
        }
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, error.message);
        return;
    }

    let nugetCommand = tl.getInput("command", true);
    switch(nugetCommand) {
        case "restore":
            nugetRestore.run(nuGetPath);
            break;
        case "pack":
            nugetPack.run(nuGetPath);
            break;
        case "push":
            nugetPublish.run(nuGetPath);
            break;
        case "custom":
            nugetCustom.run(nuGetPath);
            break;
        default:
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_CommandNotRecognized", nugetCommand));
            break;
    }
}

main();
