import * as path from 'path';
import * as task from 'azure-pipelines-task-lib/task';
import { getPlatform } from './taskutil';
import { condaEnvironment } from './conda';

(async () => {
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
        let shouldFail = task.getVariable('FAIL_DEPRECATED_BUILD_TASK');

	    if (shouldFail != null && shouldFail.toLowerCase() === 'true') {
	        throw new Error(task.loc("DeprecatedTask"));
	    }
        task.setResult(task.TaskResult.Succeeded, "");
    } catch (err) {
        if (err instanceof Error) {
            task.error(err.message);
            task.setResult(task.TaskResult.Failed, err.message);
        }
        else {
            task.error(err + '');
            task.setResult(task.TaskResult.Failed, err + '');
        }
    }
})();
