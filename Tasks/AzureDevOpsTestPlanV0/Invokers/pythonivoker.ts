import { spawn } from '../testexecutor'
import tl = require('azure-pipelines-task-lib/task');

export async function executepythontests(testsToBeExecuted: string[]) {

    const executable = 'pytest';
    let args: string[] = [];

    args.push('-v')

    for (let testcase of testsToBeExecuted) {
        args.push(testcase);
    }

    args.push('--junitxml=junit.xml')

    tl.debug("Executing python tests with executable : " + executable);
    tl.debug("Executing python tests with args :" + args);

    const { status, error } = await spawn(executable, args)

    if (error) {
        console.error(error)
    }

    return { exitCode: status ?? 1 }
}