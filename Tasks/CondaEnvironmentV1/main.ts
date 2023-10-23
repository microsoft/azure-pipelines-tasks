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
            createCustomEnvironment: task.getBoolInput('createCustomEnvironment'),
            environmentName: task.getInput('environmentName'),
            packageSpecs: task.getInput('packageSpecs'),
            updateConda: task.getBoolInput('updateConda'),
            installOptions: task.getInput('installOptions'),
            createOptions: task.getInput('createOptions'),
            cleanEnvironment: task.getBoolInput('cleanEnvironment')
        },
        getPlatform());
        task.setResult(task.TaskResult.Succeeded, "");
    } catch (e) {
#if NODE20
        error = e;
        task.setResult(task.TaskResult.Failed, error.message);
#else
        task.setResult(task.TaskResult.Failed, e.message);
#endif
    }
})();
