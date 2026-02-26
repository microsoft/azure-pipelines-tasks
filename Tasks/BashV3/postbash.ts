import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import { runBashScript, BashRunnerOptions } from './bashrunner';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Get post-job script input
        const postJobScript = tl.getInput('postJobScript', false);

        // If no post-job script is provided, skip execution
        if (!postJobScript || postJobScript.trim() === '') {
            console.log('No post-job script provided. Skipping post-job execution.');
            tl.setResult(tl.TaskResult.Succeeded, 'No post-job script provided', true);
            return;
        }

        console.log('========================== Starting Post-Job Script ===========================');

        // Get common inputs
        let input_workingDirectory = tl.getPathInput('workingDirectory', /*required*/ true, /*check*/ true);
        let input_failOnStderr = tl.getBoolInput('failOnStderr', false);
        const input_bashEnvValue: string = tl.getInput('bashEnvValue') || '';

        let options: BashRunnerOptions = {
            targetType: 'inline',
            script: postJobScript,
            workingDirectory: input_workingDirectory,
            failOnStderr: input_failOnStderr,
            bashEnvValue: input_bashEnvValue
        };

        const bashResult = await runBashScript(options, false);

        // Post-job scripts should not fail the pipeline, only warn
        if (bashResult.result === tl.TaskResult.Failed) {
            tl.warning('Post-job script failed but not failing the task');
        }

        tl.setResult(tl.TaskResult.Succeeded, null, true);
    }
    catch (err: any) {
        // Post-job scripts should not fail the pipeline, only warn
        tl.warning(err.message || 'Post-job script failed');
        tl.setResult(tl.TaskResult.Succeeded, null, true);
    }
}

run();
