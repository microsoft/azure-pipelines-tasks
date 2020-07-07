
import * as tl from 'azure-pipelines-task-lib';
import * as path from 'path';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));
        const source = tl.getInput('resourceName', true);
        console.log(tl.loc('CreatedDynamicResource', source));
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message || 'run() failed', true);
    }
}

run();
