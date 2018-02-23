import * as path from 'path';

import * as task from 'vsts-task-lib/task';
import * as tool from 'vsts-task-tool-lib/tool';

async function run(): Promise<void> {
    try {
        task.setResourcePath(path.join(__dirname, 'task.json'));
        await usePythonVersion({
            version: task.getInput('version', true),
            outputVariable: task.getInput('outputVariable', true),
            addToPath: task.getBoolInput('addToPath', true)
        });
        task.setResult(task.TaskResult.Succeeded, "");
    } catch (error) {
        task.error(error.message);
        task.setResult(task.TaskResult.Failed, error.message);
    }
}

interface TaskParameters {
    readonly version: string,
    readonly outputVariable: string,
    readonly addToPath: boolean
}

async function usePythonVersion(parameters: TaskParameters): Promise<void> {
    return Promise.resolve();
}

run();
