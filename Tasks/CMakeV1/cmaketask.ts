import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import trm = require('azure-pipelines-task-lib/toolrunner');
import { shellSplit } from 'azure-pipelines-tasks-utility-common/shellEscaping';

function neutralizeCmdSubstitution(value: string): string {
    return value
        .replace(/`/g, '\\`')
        .replace(/\$\(/g, '\\$(');
}

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        const cmake: trm.ToolRunner = tl.tool(tl.which('cmake', true));

        const cwd: string = tl.getPathInput('cwd', true, false);
        tl.mkdirP(cwd);
        tl.cd(cwd);

        const runInsideShell: boolean = tl.getBoolInput('runInsideShell', false);
        const cmakeArgs: string = tl.getInput('cmakeArgs', false);

        if (cmakeArgs) {
            if (runInsideShell && process.platform !== 'win32') {
                const tokens = shellSplit(cmakeArgs);
                tokens.forEach(t => cmake.arg(neutralizeCmdSubstitution(t)));
            } else {
                cmake.line(cmakeArgs);
            }
        }

        const options: trm.IExecOptions = <trm.IExecOptions>{
            shell: runInsideShell
        };

        const code: number = await cmake.exec(options);
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('CMakeReturnCode', code));
    }
    catch (err) {
        if (err instanceof Error) {
            tl.error(err.message);
            tl.setResult(tl.TaskResult.Failed, tl.loc('CMakeFailed', err.message));
        }
        else {
            tl.error(err + '');
            tl.setResult(tl.TaskResult.Failed, err + '' || 'run() failed', true);
        }
    }
}

run();
