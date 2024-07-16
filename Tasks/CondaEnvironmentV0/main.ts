import * as path from 'path';
import * as task from 'azure-pipelines-task-lib/task';
import { getPlatform } from './taskutil';
import { condaEnvironment } from './conda';

(async () => {
#if NODE20
    let error: any | undefined;
#endif
    try {
        task.setResourcePath(path.join(__dirname, 'task.json'));
        await condaEnvironment({
            environmentName: task.getInput('environmentName', true)!,
            packageSpecs: task.getInput('packageSpecs', false),
            updateConda: task.getBoolInput('updateConda', false),
            createOptions: task.getInput('createOptions', false),
            cleanEnvironment: task.getBoolInput('cleanEnvironment', false)
        },
        getPlatform());
        task.setResult(task.TaskResult.Succeeded, "");
    } catch (e) {
#if NODE20
        error = e;
        task.error(error.message);
        task.setResult(task.TaskResult.Failed, error.message);
#else
        task.error(e.message);
        task.setResult(task.TaskResult.Failed, e.message);
#endif
    }
})();
