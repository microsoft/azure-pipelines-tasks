import * as tl from "vsts-task-lib/task";
import * as path from "path";

import * as nugetRestore from './nugetrestore';
import * as nugetPublish from './nugetpublisher';
import * as nugetPack from './nugetpack';
import * as nugetCustom from './nugetcustom';
import nuGetGetter = require("nuget-task-common/NuGetToolGetter");

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    // Getting NuGet
    tl.debug('Getting NuGet');
    let nuGetPath: string = undefined;
    try {
        nuGetPath = process.env[nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR];
        if (!nuGetPath){
            nuGetPath = await nuGetGetter.getNuGet("4.0.0");
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
