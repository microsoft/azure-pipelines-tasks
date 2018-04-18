import * as path from 'path';
import * as task from 'vsts-task-lib/task';
import { useRubyVersion, getPlatform } from './userubyversion';

(async () => {
    try {
        task.setResourcePath(path.join(__dirname, 'task.json'));
        await useRubyVersion({
            versionSpec: task.getInput('versionSpec', true),
            addToPath: task.getBoolInput('addToPath', true)
        }, getPlatform());
        task.setResult(task.TaskResult.Succeeded, '');
    } catch (error) {
        task.error(error.message);
        task.setResult(task.TaskResult.Failed, error.message);
    }
})();
