import * as path from 'path';
import * as task from 'vsts-task-lib/task';
import { pythonScript } from './pythonscript';

(async () => {
    try {
        task.setResourcePath(path.join(__dirname, 'task.json'));
        await pythonScript({
            targetType: task.getInput('targetType'),
            filePath: task.getPathInput('filePath', true),
            arguments: task.getInput('arguments'),
            script: task.getInput('script'),
            pythonInterpreter: task.getPathInput('pythonInterpreter'),
            workingDirectory: task.getPathInput('workingDirectory'),
            failOnStderr: task.getBoolInput('failOnStderr')
        });
        task.setResult(task.TaskResult.Succeeded, "");
    } catch (error) {
        task.error(error.message);
        task.setResult(task.TaskResult.Failed, error.message);
    }
})();
