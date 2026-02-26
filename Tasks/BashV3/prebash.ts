import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import { runBashScript, BashRunnerOptions } from './bashrunner';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Get pre-job script input
        const preJobScript = tl.getInput('preJobScript', false);

        // If no pre-job script is provided, skip execution
        if (!preJobScript || preJobScript.trim() === '') {
            console.log(tl.loc('PreJobScriptNotProvided'));
            tl.setResult(tl.TaskResult.Succeeded, tl.loc('PreJobScriptNotProvided'), true);
            return;
        }

        console.log('========================== Starting Pre-Job Script ===========================');

        // Get common inputs
        let input_workingDirectory = tl.getPathInput('workingDirectory', /*required*/ true, /*check*/ true);
        let input_failOnStderr = tl.getBoolInput('failOnStderr', false);
        const input_bashEnvValue: string = tl.getInput('bashEnvValue') || '';

        let options: BashRunnerOptions = {
            targetType: 'inline',
            script: preJobScript,
            workingDirectory: input_workingDirectory,
            failOnStderr: input_failOnStderr,
            bashEnvValue: input_bashEnvValue
        };

        await runBashScript(options);
    }
    catch (err: any) {
        tl.setResult(tl.TaskResult.Failed, err.message || 'Pre-job script failed', true);
    }
}

run();
