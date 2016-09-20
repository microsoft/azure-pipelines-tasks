import path = require('path');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

async function run() {
    try {   
		tl.setResourcePath(path.join( __dirname, 'task.json'));

		var tool: string = tl.which(tl.getInput('filename', true), true);
		var tr: trm.ToolRunner = tl.tool(tool);

		var cwd = tl.getPathInput('workingFolder', true, false);
		tl.mkdirP(cwd);
		tl.cd(cwd);
		tr.line(tl.getInput('arguments', false));

		var failOnStdErr: boolean = tl.getBoolInput('failOnStandardError', false);
		var code: number = await tr.exec(<trm.IExecOptions>{failOnStdErr: failOnStdErr});
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('CmdLineReturnCode', tool, code));
    }
    catch(err) {
        tl.error(err.message);
        tl.setResult(tl.TaskResult.Failed, tl.loc('CmdLineFailed', tool, err.message));
    }
}
