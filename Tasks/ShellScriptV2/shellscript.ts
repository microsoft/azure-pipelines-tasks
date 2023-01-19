import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import trm = require('azure-pipelines-task-lib/toolrunner');

async function run() {
    try {    
        tl.setResourcePath(path.join( __dirname, 'task.json'));

        var bash: trm.ToolRunner  = tl.tool(tl.which('bash', true));

        var scriptPath: string = tl.getPathInput('scriptPath', true, true);
        var cwd: string = tl.getPathInput('cwd', true, false);

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
        var failOnStdErr: boolean = tl.getBoolInput('failOnStandardError', false);

        var code: number = await bash.exec(<any>{failOnStdErr: failOnStdErr});
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('BashReturnCode', code));
    }
    catch(err) {
        tl.error(err.message);
        tl.setResult(tl.TaskResult.Failed, tl.loc('BashFailed', err.message));
    }    
}

run();
