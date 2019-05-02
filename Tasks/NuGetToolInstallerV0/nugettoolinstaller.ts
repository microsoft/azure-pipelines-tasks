import * as taskLib from 'azure-pipelines-task-lib/task';
import * as path from "path";

import nuGetGetter = require("packaging-common/nuget/NuGetToolGetter");

async function run() {
    try {
        taskLib.setResourcePath(path.join(__dirname, "task.json"));

        let versionSpec = taskLib.getInput('versionSpec', true);
        let checkLatest = taskLib.getBoolInput('checkLatest', false);
        await nuGetGetter.getNuGet(versionSpec, checkLatest, true);
    }
    catch (error) {
        console.error('ERR:' + error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, "");
    }
}

run();