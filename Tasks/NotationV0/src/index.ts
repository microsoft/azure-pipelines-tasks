import * as taskLib from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import { install } from './install';
import { FAILED, NOTATION_BINARY, STATUS, SUCCEEDED, WARNING } from './lib/constants';
import { sign } from './sign';
import { verify } from './verify';

taskLib.setResourcePath(path.join(__dirname, '..', 'task.json'));

async function run() {
    try {
        let command = taskLib.getInput('command', true);
        switch (command) {
            case 'install':
                if (taskLib.which(NOTATION_BINARY, false)) {
                    throw new Error(taskLib.loc('NotationAlreadyInstalled'));
                }
                await install();
                break;
            case 'sign':
                // check if notation is installed before sign
                taskLib.which(NOTATION_BINARY, true);
                await sign();
                break;
            case 'verify':
                // check if notation is installed before verify
                taskLib.which(NOTATION_BINARY, true);
                await verify();
                break;
            default:
                throw new Error(taskLib.loc('UnknownCommand', command));
        }

        if (taskLib.getTaskVariable(STATUS) === WARNING) {
            taskLib.setVariable(STATUS, WARNING, false, true);
        } else {
            taskLib.setVariable(STATUS, SUCCEEDED, false, true);
        }
    } catch (err: unknown) {
        taskLib.setVariable(STATUS, FAILED, false, true);
        if (err instanceof Error) {
            taskLib.setResult(taskLib.TaskResult.Failed, err.message);
        } else {
            taskLib.setResult(taskLib.TaskResult.Failed, taskLib.loc('UnknownError'));
        }
    }
}

run();
