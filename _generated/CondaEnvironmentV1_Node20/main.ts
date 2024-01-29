import * as path from 'path';
import * as task from 'azure-pipelines-task-lib/task';
import { getPlatform } from './taskutil';
import { condaEnvironment } from './conda';

(async () => {
    let error: any | undefined;
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
    } catch (e) {
        error = e;
        task.setResult(task.TaskResult.Failed, error.message);
    }
})();
