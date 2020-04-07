import * as taskLib from 'azure-pipelines-task-lib/task';
import * as semver from 'semver';
import * as path from "path";

import nuGetGetter = require("packaging-common/nuget/NuGetToolGetter");

async function run() {
    try {
        taskLib.setResourcePath(path.join(__dirname, "task.json"));

        let versionSpec = taskLib.getInput('versionSpec', false);
        if (!versionSpec) {
            const msbuildSemVer = await nuGetGetter.getMSBuildVersion();
            if (msbuildSemVer && semver.gt(msbuildSemVer, '16.5.0')) {
                versionSpec = '4.8.2';
            } else {
                versionSpec = '4.3.0';
            }
        }
        let checkLatest = taskLib.getBoolInput('checkLatest', false);
        await nuGetGetter.getNuGet(versionSpec, checkLatest, true);
    }
    catch (error) {
        console.error('ERR:' + error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, "");
    }
}

run();