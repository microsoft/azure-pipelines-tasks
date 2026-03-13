import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import { runBashScript, BashRunnerOptions } from './bashrunner';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Get inputs
        let input_failOnStderr = tl.getBoolInput('failOnStderr', false);
        let input_workingDirectory = tl.getPathInput('workingDirectory', /*required*/ true, /*check*/ true);
        let input_targetType: string = tl.getInput('targetType') || '';
        const input_bashEnvValue: string = tl.getInput('bashEnvValue') || '';

        let options: BashRunnerOptions = {
            targetType: input_targetType.toLowerCase() as 'inline' | 'filepath',
            workingDirectory: input_workingDirectory,
            failOnStderr: input_failOnStderr,
            bashEnvValue: input_bashEnvValue
        };

        if (input_targetType.toUpperCase() == 'FILEPATH') {
            options.filePath = tl.getPathInput('filePath', /*required*/ true);
            options.arguments = tl.getInput('arguments') || '';
        } else {
            options.script = tl.getInput('script', false) || '';
        }

        await runBashScript(options);
    }
    catch (err: any) {
        tl.setResult(tl.TaskResult.Failed, err.message || 'run() failed', true);
    }
}

run();