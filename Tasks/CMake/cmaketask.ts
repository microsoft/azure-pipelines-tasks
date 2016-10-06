

import path = require('path');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

async function run() {
    try {   
		tl.setResourcePath(path.join( __dirname, 'task.json'));

		var cmake: trm.ToolRunner = tl.tool(tl.which('cmake', true));

		var cwd: string = tl.getPathInput('cwd', true, false);
		tl.mkdirP(cwd);
		tl.cd(cwd);

		cmake.line(tl.getInput('cmakeArgs', false));

		var code: number = await cmake.exec();
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('CMakeReturnCode', code));
    }
    catch(err) {
        tl.error(err.message);
        tl.setResult(tl.TaskResult.Failed, tl.loc('CMakeFailed', err.message));
    }    
}

run();
