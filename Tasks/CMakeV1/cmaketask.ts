import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import trm = require('azure-pipelines-task-lib/toolrunner');
import { CommandHelper } from './commandhelper'

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        const cmake: trm.ToolRunner = tl.tool(tl.which('cmake', true));

        const cwd: string = tl.getPathInput('cwd', true, false);
        tl.mkdirP(cwd);
        tl.cd(cwd);

        const cmakeArgs: string = tl.getInput('cmakeArgs', false);
        const processedArgs: string = CommandHelper.replaceEnvVariablesWithValues(cmakeArgs);
        cmake.line(processedArgs);
        
        const code: number = await cmake.exec();
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('CMakeReturnCode', code));
    }
    catch (err) {
        tl.error(err.message);
        tl.setResult(tl.TaskResult.Failed, tl.loc('CMakeFailed', err.message));
    }    
}

run();
