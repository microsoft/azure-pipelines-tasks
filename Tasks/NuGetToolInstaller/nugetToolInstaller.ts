import * as taskLib from 'vsts-task-lib/task';
// Remove once task lib 2.0.4 releases
global['_vsts_task_lib_loaded'] = true;
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as restm from 'typed-rest-client/RestClient';
import * as path from "path";

import nuGetGetter = require("nuget-task-common/NuGetToolGetter");

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