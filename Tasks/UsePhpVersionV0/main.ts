import * as path from 'path';
import * as task from 'vsts-task-lib/task';
import { getPlatform } from './taskutil';
import { usePhpVersion } from './usephpversion';

(async () => {
    try {
        task.setResourcePath(path.join(__dirname, 'task.json'));
        await usePhpVersion({
            versionSpec: task.getInput('versionSpec', true),
            architecture: task.getInput('architecture', true)
        },
        getPlatform());
        task.setResult(task.TaskResult.Succeeded, "");
    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
})();
