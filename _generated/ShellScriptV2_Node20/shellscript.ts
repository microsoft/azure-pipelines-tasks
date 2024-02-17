import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import trm = require('azure-pipelines-task-lib/toolrunner');

async function run() {  
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));

        let bash: trm.ToolRunner  = tl.tool(tl.which('bash', true));

        let scriptPath: string = tl.getPathInput('scriptPath', true, true);
        let cwd: string = tl.getPathInput('cwd', true, false);

        // if user didn't supply a cwd (advanced), then set cwd to folder script is in.
        // All "script" tasks should do this
        if (!tl.filePathSupplied('cwd') && !tl.getBoolInput('disableAutoCwd', false)) {
            cwd = path.dirname(scriptPath);
        }
        tl.mkdirP(cwd);
        tl.cd(cwd);

        bash.arg(scriptPath);

        // additional args should always call argString.  argString() parses quoted arg strings
        bash.line(tl.getInput('args', false));

        // determines whether output to stderr will fail a task.
        // some tools write progress and other warnings to stderr.  scripts can also redirect.
        let failOnStdErr: boolean = tl.getBoolInput('failOnStandardError', false);

        let options = <trm.IExecOptions>{
            failOnStdErr: failOnStdErr,
            ignoreReturnCode: true
        };

        let exitCode: number = await bash.exec(options);

        let result = tl.TaskResult.Succeeded;

        if (exitCode !== 0)
        {
            if (exitCode == 137) {
                tl.error(tl.loc('BashFailedWithCode137'));
            }
            else {
                tl.error(tl.loc('BashFailed', exitCode));
            }
            result = tl.TaskResult.Failed;
        }

        tl.setResult(result, tl.loc('BashReturnCode', exitCode));
    }
    catch (err: any) {
        tl.setResult(tl.TaskResult.Failed, err.message, true);
    }
}

run();
