import * as path from 'path';
import * as task from 'azure-pipelines-task-lib/task';
import { getPlatform } from './taskutil';
import { usePythonVersion } from './usepythonversion';
import * as os from 'os';

(async () => {
    try {
        const arch: string = task.getInput('architecture') || os.arch();

        task.setResourcePath(path.join(__dirname, 'task.json'));
        await usePythonVersion({
            versionSpec: task.getInput('versionSpec', true),
            addToPath: task.getBoolInput('addToPath', true),
            architecture: arch
        },
        getPlatform());
        task.setResult(task.TaskResult.Succeeded, "");
    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
})();
