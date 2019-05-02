import * as taskLib from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as nuGetGetter from 'packaging-common/nuget/NuGetToolGetter';

const DEFAULT_NUGET_VERSION = '>=4.9';

async function run() {
    try {
        taskLib.setResourcePath(path.join(__dirname, 'task.json'));

        const versionSpec = taskLib.getInput('versionSpec', false) || DEFAULT_NUGET_VERSION;
        const checkLatest = taskLib.getBoolInput('checkLatest', false);
        await nuGetGetter.getNuGet(versionSpec, checkLatest, true);
    } catch (error) {
        console.error('ERR:' + error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, '');
    }
}

run();